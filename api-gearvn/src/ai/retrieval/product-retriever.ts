import { OpenRouterBgeM3Client } from '../embeddings/openrouter-bge-m3.client';
import { QdrantProductsClient } from '../vector/qdrant-products.client';
import { ProductLexicalSearchService } from './product-lexical-search.service';
import {
  ProductCandidate,
  ProductCragRetryMetadata,
  ProductRetrievalConstraints,
  ProductRetrievalFilter,
  ProductRetrievalQuery,
  ProductRetrievalResult,
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
    const firstPass = await this.runHybridSearch(query, callerConstraints, topK);
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
      buildCragExplanation(query, rewrite.relaxedConstraints),
      query,
    );
  }

  private async runHybridSearch(
    query: string,
    callerConstraints: ProductRetrievalConstraints,
    topK: number,
    options: { enforceRequiredSpecs?: boolean } = {},
  ): Promise<HybridSearchPass> {
    const retrievalQuery = buildRetrievalQuery(query, callerConstraints);
    const embedding = await this.embedder.embedQuery(retrievalQuery.expandedText);
    const vectorValues = Array.isArray(embedding)
      ? embedding
      : (embedding.vectors[0] ?? []);
    const [vectorCandidates, lexicalCandidates] = await Promise.all([
      this.vector.queryProducts(vectorValues, {
        limit: Math.max(topK, 30),
        filters: vectorFilters(retrievalQuery.constraints),
      }),
      this.lexical?.search(query, {
        limit: Math.max(topK, 30),
        constraints: retrievalQuery.constraints,
      }) ?? Promise.resolve([]),
    ]);
    const normalizedVectorCandidates = normalizeCandidates(vectorCandidates, 'vector');
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
      results: rerankProducts(query, normalizedCandidates, {
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
): ProductRetrievalQuery {
  const expanded = expandProductQuery(query);
  const constraints = mergeRetrievalConstraints(
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

function mergeSearchConstraints(
  ...constraints: Array<ProductRetrievalConstraints | undefined>
): ProductRetrievalConstraints {
  return constraints.reduce<ProductRetrievalConstraints>(
    (merged, next) => mergeRetrievalConstraints(merged, next),
    {},
  );
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

function buildCragExplanation(
  query: string,
  relaxedConstraints: string[],
): string | undefined {
  if (relaxedConstraints.includes('rtx_4090')) {
    return `Không tìm thấy cấu hình RTX 4090 phù hợp với ràng buộc trong "${query}", nên hệ thống nới riêng yêu cầu RTX 4090 và giữ lại ngân sách/danh mục để tìm lựa chọn gần nhất.`;
  }
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

function dedupeHybridCandidates(candidates: ProductCandidate[]): ProductCandidate[] {
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
      lexicalScore: Math.max(existing.lexicalScore ?? 0, candidate.lexicalScore ?? 0),
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

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}
