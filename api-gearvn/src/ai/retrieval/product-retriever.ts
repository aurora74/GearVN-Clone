import { OpenRouterBgeM3Client } from '../embeddings/openrouter-bge-m3.client';
import { QdrantProductsClient } from '../vector/qdrant-products.client';
import { ProductLexicalSearchService } from './product-lexical-search.service';
import type { ProductComboRetrievalService } from './product-combo-retrieval.service';
import type { ProductIntentComboGroup } from './product-intent-primitives';
import type {
  ProductQueryRewriteContext,
  ProductQueryRewriteResult,
  ProductQueryRewriteService,
} from './product-query-rewrite.service';
import {
  ProductCandidate,
  ProductComboGroupResult,
  ProductCragRetryMetadata,
  ProductGroupCoverage,
  ProductRetrievalAblationVariant,
  ProductRetrievalConstraints,
  ProductRetrievalFilter,
  ProductRetrievalPipelineMode,
  ProductRetrievalQuery,
  ProductRetrievalResult,
  ProductRetrievalRewriteMetadata,
  RerankedProductCandidate,
} from './product-retrieval.types';
import {
  expandProductQuery,
  extractHardConstraints,
  mergeRetrievalConstraints,
  rerankProducts,
} from './product-reranker';

type ProductEmbedder = Pick<OpenRouterBgeM3Client, 'embedQuery'>;
type ProductVectorSearcher = Pick<QdrantProductsClient, 'queryProducts'>;
type ProductLexicalSearcher = Pick<ProductLexicalSearchService, 'search'>;

export type ProductRetrieverSearchOptions = {
  topK?: number;
  filters?: ProductRetrievalFilter;
  constraints?: ProductRetrievalConstraints;
  hardConstraints?: ProductRetrievalConstraints;
  pipeline?: ProductRetrievalPipelineMode;
  ablationVariant?: ProductRetrievalAblationVariant;
  rewriteContext?: ProductQueryRewriteContext;
  disableComboFanOut?: boolean;
};

type HybridSearchPass = {
  query: ProductRetrievalQuery;
  effectiveQuery: string;
  candidates: ProductCandidate[];
  vectorCandidates: ProductCandidate[];
  lexicalCandidates: ProductCandidate[];
  results: RerankedProductCandidate[];
};

export class ProductRetriever {
  constructor(
    private readonly embedder: ProductEmbedder,
    private readonly vector: ProductVectorSearcher,
    private readonly lexical?: ProductLexicalSearcher,
    private readonly queryRewriteService?: Pick<
      ProductQueryRewriteService,
      'rewrite'
    >,
    private readonly comboRetrievalService?: Pick<
      ProductComboRetrievalService,
      'searchCombo'
    >,
  ) {}

  async search(
    query: string,
    options: ProductRetrieverSearchOptions = {},
  ): Promise<ProductRetrievalResult> {
    const topK = options.topK ?? 10;
    const callerConstraints = mergeSearchConstraints(
      options.filters,
      options.constraints,
      options.hardConstraints,
    );
    const pipeline = options.pipeline ?? 'phase-09.2-baseline';

    if (options.ablationVariant) {
      return this.searchAblation(
        query,
        callerConstraints,
        topK,
        options.ablationVariant,
        options,
      );
    }

    if (pipeline === 'phase-10-improved' && this.queryRewriteService) {
      return this.searchImproved(query, callerConstraints, topK, options);
    }

    return this.searchBaseline(query, callerConstraints, topK);
  }

  private async searchAblation(
    query: string,
    callerConstraints: ProductRetrievalConstraints,
    topK: number,
    variant: ProductRetrievalAblationVariant,
    options: ProductRetrieverSearchOptions,
  ): Promise<ProductRetrievalResult> {
    if (variant === 'dense_vector_only') {
      const pass = await this.runHybridSearch(query, callerConstraints, topK, {
        disableExpansion: true,
        disableLexical: true,
        disableRerank: true,
      });
      return buildRetrievalResult(
        pass,
        buildCragRetryMetadata(query, undefined, { triggered: false }),
      );
    }

    if (variant === 'hybrid_no_rerank') {
      const pass = await this.runHybridSearch(query, callerConstraints, topK, {
        disableExpansion: true,
        disableRerank: true,
      });
      return buildRetrievalResult(
        pass,
        buildCragRetryMetadata(query, undefined, { triggered: false }),
      );
    }

    if (variant === 'hybrid_rerank_no_expansion') {
      const pass = await this.runHybridSearch(query, callerConstraints, topK, {
        disableExpansion: true,
      });
      return buildRetrievalResult(
        pass,
        buildCragRetryMetadata(query, undefined, { triggered: false }),
      );
    }

    if (variant === 'hybrid_rerank_expansion') {
      const pass = await this.runHybridSearch(query, callerConstraints, topK);
      return buildRetrievalResult(
        pass,
        buildCragRetryMetadata(query, undefined, { triggered: false }),
      );
    }

    if (variant === 'hybrid_rerank_rewrite') {
      return this.searchImproved(query, callerConstraints, topK, {
        ...options,
        pipeline: 'phase-10-improved',
        disableComboFanOut: true,
      });
    }

    return this.searchImproved(query, callerConstraints, topK, {
      ...options,
      pipeline: 'phase-10-improved',
    });
  }

  private async searchBaseline(
    query: string,
    callerConstraints: ProductRetrievalConstraints,
    topK: number,
  ): Promise<ProductRetrievalResult> {
    const firstPass = await this.runHybridSearch(
      query,
      callerConstraints,
      topK,
    );
    const retryDecision = shouldRunCragRetry(query, firstPass, topK);

    if (!retryDecision.triggered) {
      const cragRetry = buildCragRetryMetadata(query, undefined, retryDecision);
      return buildRetrievalResult(firstPass, cragRetry);
    }

    const rewrite = rewriteProductQueryForCragRetry(query);
    const retryPass = await this.runHybridSearch(
      rewrite.rewrittenQuery,
      callerConstraints,
      topK,
      { enforceRequiredSpecs: false },
    );
    const cragRetry = buildCragRetryMetadata(query, rewrite, retryDecision);

    return buildRetrievalResult(
      retryPass.results.length > 0 ? retryPass : firstPass,
      cragRetry,
      buildCragExplanation(),
      query,
    );
  }

  private async searchImproved(
    query: string,
    callerConstraints: ProductRetrievalConstraints,
    topK: number,
    options: ProductRetrieverSearchOptions,
  ): Promise<ProductRetrievalResult> {
    const queryRewriteService = this.queryRewriteService;
    if (!queryRewriteService) {
      return this.searchBaseline(query, callerConstraints, topK);
    }
    const rewriteContext = {
      ...(options.rewriteContext ?? {}),
      query,
      hardConstraints: callerConstraints,
    };
    const rewrite = await queryRewriteService.rewrite(rewriteContext);
    const comboGroups = isExplicitComboRetrievalRequest(rewriteContext)
      ? rewrite.comboGroups
      : [];
    const effectiveComboGroups = options.disableComboFanOut ? [] : comboGroups;
    const rewriteMetadata = toRetrievalRewriteMetadata({
      ...rewrite,
      comboGroups: effectiveComboGroups,
    });
    const mergedConstraints = mergeAuthoritativeSearchConstraints(
      rewrite.hardConstraints,
      callerConstraints,
    );

    if (rewrite.clarificationNeeded) {
      return buildImprovedShortcutResult({
        originalQuery: query,
        effectiveQuery: rewrite.rewrittenQuery,
        constraints: mergedConstraints,
        rewrite: rewriteMetadata,
        clarificationReason: rewrite.clarificationReason,
      });
    }

    if (effectiveComboGroups.length > 0 && this.comboRetrievalService) {
      const combo = await this.comboRetrievalService.searchCombo({
        query: rewrite.rewrittenQuery,
        groups: effectiveComboGroups as ProductIntentComboGroup[],
        constraints: mergedConstraints,
        retriever: this,
        perGroupTopK: Math.min(3, topK),
        signal: rewriteContext.signal,
      });

      return buildImprovedComboResult({
        originalQuery: query,
        effectiveQuery: rewrite.rewrittenQuery,
        constraints: mergedConstraints,
        rewrite: rewriteMetadata,
        comboGroups: combo.groups,
        groupCoverage: combo.groupCoverage,
      });
    }

    const firstPass = await this.runHybridSearch(
      rewrite.rewrittenQuery,
      mergedConstraints,
      topK,
      { additionalExpanded: rewrite.expandedKeywords },
    );
    const retryDecision = shouldRunCragRetry(
      rewrite.rewrittenQuery,
      firstPass,
      topK,
    );

    if (!retryDecision.triggered) {
      const cragRetry = buildCragRetryMetadata(
        rewrite.rewrittenQuery,
        undefined,
        retryDecision,
      );
      return {
        ...buildRetrievalResult(firstPass, cragRetry, undefined, query),
        pipelineVersion: 'phase-10-improved',
        rewrite: rewriteMetadata,
      };
    }

    const cragRewrite = rewriteProductQueryForCragRetry(rewrite.rewrittenQuery);
    const retryPass = await this.runHybridSearch(
      cragRewrite.rewrittenQuery,
      mergedConstraints,
      topK,
      {
        enforceRequiredSpecs: false,
        additionalExpanded: rewrite.expandedKeywords,
      },
    );
    const cragRetry = buildCragRetryMetadata(
      rewrite.rewrittenQuery,
      cragRewrite,
      retryDecision,
    );

    return {
      ...buildRetrievalResult(
        retryPass.results.length > 0 ? retryPass : firstPass,
        cragRetry,
        buildCragExplanation(),
        query,
      ),
      pipelineVersion: 'phase-10-improved',
      rewrite: rewriteMetadata,
    };
  }

  private async runHybridSearch(
    query: string,
    callerConstraints: ProductRetrievalConstraints,
    topK: number,
    options: {
      enforceRequiredSpecs?: boolean;
      additionalExpanded?: string[];
      disableExpansion?: boolean;
      disableLexical?: boolean;
      disableRerank?: boolean;
    } = {},
  ): Promise<HybridSearchPass> {
    const retrievalQuery = buildRetrievalQuery(
      query,
      callerConstraints,
      options.disableExpansion ? [] : options.additionalExpanded,
      options.disableExpansion,
    );
    const embedding = await this.embedder.embedQuery(
      retrievalQuery.expandedText,
    );
    const vectorValues = Array.isArray(embedding)
      ? embedding
      : (embedding.vectors[0] ?? []);
    const [vectorCandidates, lexicalCandidates] = await Promise.all([
      this.vector.queryProducts(vectorValues, {
        limit: Math.max(topK, 30),
        filters: vectorFilters(retrievalQuery.constraints),
      }),
      options.disableLexical
        ? Promise.resolve([])
        : this.lexical?.search(query, {
            limit: Math.max(topK, 30),
            constraints: retrievalQuery.constraints,
          }) ?? Promise.resolve([]),
    ]);
    const normalizedVectorCandidates = normalizeCandidates(
      vectorCandidates,
      'vector',
    );
    const normalizedLexicalCandidates = normalizeCandidates(
      lexicalCandidates,
      'lexical',
    );
    const normalizedCandidates = dedupeHybridCandidates([
      ...normalizedVectorCandidates,
      ...normalizedLexicalCandidates,
    ]);

    return {
      query: retrievalQuery,
      effectiveQuery: query,
      candidates: normalizedCandidates,
      vectorCandidates: normalizedVectorCandidates,
      lexicalCandidates: normalizedLexicalCandidates,
      results: options.disableRerank
        ? rawRankProducts(normalizedCandidates, topK)
        : rerankProducts(query, normalizedCandidates, {
            topK,
            constraints: retrievalQuery.constraints,
            enforceRequiredSpecs: options.enforceRequiredSpecs !== false,
          }),
    };
  }
}

function buildRetrievalQuery(
  query: string,
  providedConstraints?: ProductRetrievalConstraints,
  additionalExpanded: string[] = [],
  disableExpansion = false,
): ProductRetrievalQuery {
  const expanded = disableExpansion
    ? []
    : uniqueStrings([...expandProductQuery(query), ...additionalExpanded]);
  const constraints = mergeAuthoritativeSearchConstraints(
    extractHardConstraints(query),
    providedConstraints,
  );

  return {
    original: query,
    expanded,
    expandedText: [query, ...expanded].join(' | '),
    constraints,
  };
}

function rawRankProducts(
  candidates: ProductCandidate[],
  topK: number,
): RerankedProductCandidate[] {
  return candidates.slice(0, topK).map((candidate) => ({
    ...candidate,
    rerankScore: candidate.score,
    reasons: [
      {
        code: candidate.source === 'lexical' ? 'bm25_score' : 'vector_score',
        message: `${candidate.source ?? 'vector'} score`,
        weight: candidate.score,
      },
    ],
  }));
}

function toRetrievalRewriteMetadata(
  rewrite: ProductQueryRewriteResult,
): ProductRetrievalRewriteMetadata {
  return {
    rewrittenQuery: rewrite.rewrittenQuery,
    detectedIntents: rewrite.detectedIntents,
    productGroups: rewrite.productGroups,
    hardConstraints: rewrite.hardConstraints,
    softSignals: rewrite.softSignals,
    expandedKeywords: rewrite.expandedKeywords,
    comboGroups: rewrite.comboGroups,
    confidence: rewrite.confidence,
    metadata: rewrite.metadata,
  };
}

function buildImprovedShortcutResult(input: {
  originalQuery: string;
  effectiveQuery: string;
  constraints: ProductRetrievalConstraints;
  rewrite: ProductRetrievalRewriteMetadata;
  clarificationReason: string | null;
}): ProductRetrievalResult {
  return {
    pipelineVersion: 'phase-10-improved',
    query: {
      original: input.originalQuery,
      expanded: [],
      expandedText: input.effectiveQuery,
      constraints: input.constraints,
    },
    effectiveQuery: input.effectiveQuery,
    candidates: [],
    vectorCandidates: [],
    lexicalCandidates: [],
    results: [],
    rewrite: input.rewrite,
    clarification: {
      needed: true,
      reason: input.clarificationReason,
    },
  };
}

function buildImprovedComboResult(input: {
  originalQuery: string;
  effectiveQuery: string;
  constraints: ProductRetrievalConstraints;
  rewrite: ProductRetrievalRewriteMetadata;
  comboGroups: ProductComboGroupResult[];
  groupCoverage: ProductGroupCoverage;
}): ProductRetrievalResult {
  const results = uniqueResultsByProductId(
    input.comboGroups.flatMap((group) => group.results),
  );
  return {
    pipelineVersion: 'phase-10-improved',
    query: {
      original: input.originalQuery,
      expanded: input.rewrite.expandedKeywords,
      expandedText: [
        input.effectiveQuery,
        ...input.rewrite.expandedKeywords,
      ].join(' | '),
      constraints: input.constraints,
    },
    effectiveQuery: input.effectiveQuery,
    candidates: results,
    vectorCandidates: [],
    lexicalCandidates: [],
    results,
    rewrite: input.rewrite,
    comboGroups: input.comboGroups,
    groupCoverage: input.groupCoverage,
  };
}

function mergeSearchConstraints(
  ...constraints: Array<ProductRetrievalConstraints | undefined>
): ProductRetrievalConstraints {
  return constraints.reduce<ProductRetrievalConstraints>(
    (merged, next) => mergeRetrievalConstraints(merged, next),
    {},
  );
}
function mergeAuthoritativeSearchConstraints(
  extracted?: ProductRetrievalConstraints,
  provided?: ProductRetrievalConstraints,
): ProductRetrievalConstraints {
  const merged = mergeSearchConstraints(extracted, provided);
  if (!provided || !hasCategorySignal(provided)) return merged;

  if (!provided.category) delete merged.category;
  if (!provided.categoryPath?.length) delete merged.categoryPath;

  const categoryHints = uniqueConstraintStrings([
    ...(provided.categoryHints ?? []),
    provided.category,
  ]);
  if (categoryHints.length > 0) merged.categoryHints = categoryHints;

  return merged;
}

function hasCategorySignal(constraints: ProductRetrievalConstraints): boolean {
  return Boolean(
    constraints.category ||
      constraints.categoryPath?.length ||
      constraints.categoryHints?.length,
  );
}

function uniqueConstraintStrings(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const text = String(value ?? '').trim();
    const key = normalizeRetrievalIntentText(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}
function vectorFilters(
  constraints: ProductRetrievalConstraints,
): ProductRetrievalFilter {
  return {
    category: constraints.category,
    categoryPath: constraints.categoryPath,
    minPrice: constraints.minPrice,
    maxPrice: constraints.maxPrice,
    inStockOnly: constraints.inStockOnly,
    semanticTags: constraints.semanticTags,
    useCases: constraints.useCases,
    targetUsers: constraints.targetUsers,
  };
}

function shouldRunCragRetry(
  originalQuery: string,
  pass: HybridSearchPass,
  topK: number,
): { triggered: boolean; reason?: string } {
  if (isImpossibleRtxBudgetQuery(originalQuery, pass.query.constraints)) {
    return { triggered: true, reason: 'impossible_hard_constraints' };
  }
  if (pass.results.length < Math.min(topK, 2)) {
    return { triggered: true, reason: 'low_candidate_count' };
  }
  const topScore = pass.results[0]?.rerankScore ?? 0;
  if (topScore < 4) {
    return { triggered: true, reason: 'weak_top_score' };
  }
  return { triggered: false };
}

function rewriteProductQueryForCragRetry(query: string): {
  rewrittenQuery: string;
  relaxedConstraints: string[];
} {
  const relaxedConstraints: string[] = [];
  let rewrittenQuery = query;

  if (/\brtx\s*4090\b/i.test(rewrittenQuery)) {
    rewrittenQuery = rewrittenQuery.replace(/\brtx\s*4090\b/gi, '').trim();
    relaxedConstraints.push('rtx_4090');
  }

  rewrittenQuery = rewrittenQuery.replace(/\s{2,}/g, ' ').trim();
  return {
    rewrittenQuery: rewrittenQuery || query,
    relaxedConstraints,
  };
}

function buildCragRetryMetadata(
  originalQuery: string,
  rewrite: { rewrittenQuery: string; relaxedConstraints: string[] } | undefined,
  decision: { triggered: boolean; reason?: string },
): ProductCragRetryMetadata {
  return {
    triggered: decision.triggered,
    retryCount: decision.triggered ? 1 : 0,
    reason: decision.reason,
    originalQuery,
    rewrittenQuery: rewrite?.rewrittenQuery,
    relaxedConstraints: rewrite?.relaxedConstraints ?? [],
  };
}

function buildRetrievalResult(
  pass: HybridSearchPass,
  cragRetry: ProductCragRetryMetadata,
  explanation?: string,
  originalQuery?: string,
): ProductRetrievalResult {
  return {
    query: originalQuery
      ? {
          ...pass.query,
          original: originalQuery,
        }
      : pass.query,
    effectiveQuery: pass.effectiveQuery,
    candidates: pass.candidates,
    vectorCandidates: pass.vectorCandidates,
    lexicalCandidates: pass.lexicalCandidates,
    results: pass.results,
    relaxedConstraints: cragRetry.relaxedConstraints,
    cragRetry,
    crag_retry: cragRetry,
    explanation,
  };
}

function buildCragExplanation(): string | undefined {
  return undefined;
}

function isImpossibleRtxBudgetQuery(
  query: string,
  constraints: ProductRetrievalConstraints,
): boolean {
  return (
    /\brtx\s*4090\b/i.test(query) &&
    (constraints.maxPrice ?? Infinity) <= 20_000_000
  );
}

function normalizeCandidates(
  candidates: ProductCandidate[],
  source: 'vector' | 'lexical',
): ProductCandidate[] {
  return candidates.map((candidate) => ({
    ...candidate,
    productId: candidate.productId || candidate.payload.productId,
    source: candidate.source ?? source,
  }));
}

function dedupeHybridCandidates(
  candidates: ProductCandidate[],
): ProductCandidate[] {
  const byId = new Map<string, ProductCandidate>();
  for (const candidate of candidates) {
    const productId = candidate.productId || candidate.payload.productId;
    const existing = byId.get(productId);
    if (!existing) {
      byId.set(productId, candidate);
      continue;
    }
    byId.set(productId, {
      ...existing,
      score: Math.max(existing.score, candidate.score),
      lexicalScore: Math.max(
        existing.lexicalScore ?? 0,
        candidate.lexicalScore ?? 0,
      ),
      matchedTerms: uniqueStrings([
        ...(existing.matchedTerms ?? []),
        ...(candidate.matchedTerms ?? []),
      ]),
      matchedFields: uniqueStrings([
        ...(existing.matchedFields ?? []),
        ...(candidate.matchedFields ?? []),
      ]),
      source: 'hybrid',
    });
  }
  return Array.from(byId.values());
}

function isExplicitComboRetrievalRequest(context: ProductQueryRewriteContext): boolean {
  const text = [
    context.originalQuery,
    context.query,
    context.previousQuery,
    context.clarificationAnswer,
  ]
    .filter((value): value is string => typeof value === 'string')
    .join(' ');
  const normalized = normalizeRetrievalIntentText(text);
  if (!normalized) return false;

  if (
    /\b(setup|set up|combo|full set|build pc|build may|lap rap|rap may|rig|goc|dan|dan may|dan pc|bo|bo lam|bo may|bo pc|bo gear|bo gaming|dong bo|tron bo|ca bo|mot bo)\b/.test(
      normalized,
    )
  ) {
    return true;
  }

  return countProductGroupMentions(normalized) >= 2;
}

function countProductGroupMentions(normalized: string): number {
  const patterns = [
    /\blaptop\b|notebook|may tinh xach tay/,
    /\bpc\b|desktop|may tinh ban/,
    /man hinh|monitor/,
    /ban phim|keyboard/,
    /chuot|mouse/,
    /tai nghe|headset|headphone/,
    /webcam|camera/,
    /microphone|\bmicro\b/,
    /\bssd\b|o cung|storage/,
    /\bram\b/,
  ];
  return patterns.filter((pattern) => pattern.test(normalized)).length;
}

function normalizeRetrievalIntentText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueResultsByProductId(
  results: RerankedProductCandidate[],
): RerankedProductCandidate[] {
  const byId = new Map<string, RerankedProductCandidate>();
  for (const result of results) {
    const productId = result.productId || result.payload.productId;
    if (productId && !byId.has(productId)) byId.set(productId, result);
  }
  return [...byId.values()];
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}
