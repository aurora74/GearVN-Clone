import { ProductRetriever } from './product-retriever';
import {
  BenchmarkCase,
  ProductBenchmarkLabelSource,
  ProductRetrievalConstraints,
  ProductRetrievalPipelineMode,
  ProductRetrievalResult,
  ProductSearchPayload,
  RerankedProductCandidate,
} from './product-retrieval.types';
import { productRetrievalBenchmarkCases } from './product-retrieval.benchmark-cases';
import type { ProductQueryRewriteContext } from './product-query-rewrite.service';

export type BenchmarkTopKProduct = {
  productId: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  score: number;
  vectorScore: number;
  reasons: string[];
};

export type ProductBenchmarkRewriteMetadata = {
  rewriteProvider?: string;
  rewriteModel?: string;
  rewriteStatus?: string;
  rewriteRetryCount?: number;
  rewriteLatencyMs?: number;
  rewrittenQuery?: string;
};

export type { ProductBenchmarkLabelSource } from './product-retrieval.types';

export type ProductBenchmarkQueryResult = {
  caseId: string;
  query: string;
  group: BenchmarkCase['group'];
  labelSource: ProductBenchmarkLabelSource;
  relevantSetSize: number;
  topKRelevantHits: number;
  topK: BenchmarkTopKProduct[];
  metrics: Record<'Recall@10' | 'Precision@5' | 'MRR' | 'nDCG@10', number>;
  relevantFound: boolean;
  clarified: boolean;
  groupCoverage: number;
  rewrite?: ProductBenchmarkRewriteMetadata;
  failureReason?: string;
};

export type ProductRetrievalBenchmarkSummary = Record<
  | 'Recall@10'
  | 'Precision@5'
  | 'MRR'
  | 'nDCG@10'
  | 'Failure Rate'
  | 'Clarification Rate'
  | 'Group Coverage',
  number
>;

export type QrelsCoverage = {
  totalCases: number;
  manual_binary_qrels: number;
  expected_product_ids: number;
  expected_clarification: number;
  category_corpus: number;
  nonAmbiguousUnlabeled: number;
};

export type ProductRetrievalBenchmarkReport = {
  summary: ProductRetrievalBenchmarkSummary;
  results: ProductBenchmarkQueryResult[];
  qrelsCoverage: QrelsCoverage;
};

export type ProductRetrievalComparisonReport = {
  benchmarkReport: true;
  baselineVersion: 'phase-09.2';
  improvedVersion: 'phase-10';
  rewriteModel: string;
  baseline: ProductRetrievalBenchmarkReport;
  improved: ProductRetrievalBenchmarkReport;
  deltas: ProductRetrievalBenchmarkSummary;
  relativeGate: {
    passed: boolean;
    checks: Record<
      | 'recallAt10Improved'
      | 'mrrImproved'
      | 'ndcgAt10Improved'
      | 'failureRateLower'
      | 'keywordRecallNotRegressed',
      boolean
    >;
  };
  qrelsCoverage: QrelsCoverage;
  failures: Array<{ caseId: string; pipeline: ProductRetrievalPipelineMode; reason: string }>;
  secretKeysLogged: false;
};

export function recallAtK(
  rankedIds: string[],
  relevantIds: Set<string>,
  k: number,
): number {
  if (relevantIds.size === 0) return 0;
  const hits = rankedIds.slice(0, k).filter((id) => relevantIds.has(id)).length;
  return roundMetric(hits / relevantIds.size);
}

export function precisionAtK(
  rankedIds: string[],
  relevantIds: Set<string>,
  k: number,
): number {
  if (k <= 0) return 0;
  const hits = rankedIds.slice(0, k).filter((id) => relevantIds.has(id)).length;
  return roundMetric(hits / k);
}

export function reciprocalRank(
  rankedIds: string[],
  relevantIds: Set<string>,
): number {
  const index = rankedIds.findIndex((id) => relevantIds.has(id));
  return index === -1 ? 0 : roundMetric(1 / (index + 1));
}

export function meanReciprocalRank(
  rankedLists: string[][],
  relevantLists: Set<string>[],
): number {
  if (rankedLists.length === 0) return 0;
  const total = rankedLists.reduce(
    (sum, rankedIds, index) =>
      sum + reciprocalRank(rankedIds, relevantLists[index] ?? new Set()),
    0,
  );
  return roundMetric(total / rankedLists.length);
}

export function dcgAtK(
  rankedIds: string[],
  relevantIds: Set<string>,
  k: number,
): number {
  return rankedIds.slice(0, k).reduce((sum, id, index) => {
    if (!relevantIds.has(id)) return sum;
    return sum + 1 / Math.log2(index + 2);
  }, 0);
}

export function ndcgAtK(
  rankedIds: string[],
  relevantIds: Set<string>,
  k: number,
): number {
  const ideal = Array.from(relevantIds).slice(0, k);
  const idealDcg = dcgAtK(ideal, relevantIds, k);
  if (idealDcg === 0) return 0;
  return roundMetric(dcgAtK(rankedIds, relevantIds, k) / idealDcg);
}

export function failureRate(
  results: Array<{ relevantFound: boolean }>,
): number {
  if (results.length === 0) return 0;
  return roundMetric(
    results.filter((result) => !result.relevantFound).length / results.length,
  );
}

export function clarificationRate(
  results: Array<{ clarified: boolean }>,
): number {
  if (results.length === 0) return 0;
  return roundMetric(
    results.filter((result) => result.clarified).length / results.length,
  );
}
type ProductRetrievalBenchmarkOptions = {
  topK?: number;
  relevanceCorpus?: ProductSearchPayload[];
  pipeline?: ProductRetrievalPipelineMode;
  rewriteModel?: string;
  rewriteTimeoutMs?: number;
  allowDeterministicShortCircuit?: boolean;
  continueOnError?: boolean;
};
type BenchmarkSearchOptions = {
  topK: number;
  filters?: ProductRetrievalConstraints;
  hardConstraints?: ProductRetrievalConstraints;
  pipeline?: ProductRetrievalPipelineMode;
  rewriteContext?: ProductQueryRewriteContext;
};
export async function runProductRetrievalBenchmark(
  retriever: ProductRetriever,
  cases: BenchmarkCase[] = productRetrievalBenchmarkCases,
  options: ProductRetrievalBenchmarkOptions = {},
): Promise<ProductRetrievalBenchmarkReport> {
  const topK = options.topK ?? 10;
  const results: ProductBenchmarkQueryResult[] = [];
  const rankedLists: string[][] = [];
  const relevantLists: Set<string>[] = [];
  const rankingMetricResults: ProductBenchmarkQueryResult[] = [];
  for (const benchmarkCase of cases) {
    const searchOptions: BenchmarkSearchOptions = {
      topK,
      pipeline: options.pipeline,
    };
    if (benchmarkCase.hardConstraints) {
      searchOptions.filters = benchmarkCase.hardConstraints;
      searchOptions.hardConstraints = benchmarkCase.hardConstraints;
    }
    if (options.pipeline === 'phase-10-improved') {
      searchOptions.rewriteContext = {
        query: benchmarkCase.query,
        originalQuery: benchmarkCase.query,
        hardConstraints: benchmarkCase.hardConstraints,
        timeoutMs: options.rewriteTimeoutMs,
        allowDeterministicShortCircuit:
          options.allowDeterministicShortCircuit !== false,
      };
    }

    const relevance = relevanceForCase(
      benchmarkCase,
      options.relevanceCorpus ?? [],
    );
    const relevantIds = relevance.relevantIds;
    let retrieval: ProductRetrievalResult;
    try {
      retrieval = await retriever.search(benchmarkCase.query, searchOptions);
    } catch (error) {
      if (options.continueOnError === false) {
        throw error;
      }
      const expectedClarification = benchmarkCase.expectedClarification === true;
      if (!expectedClarification) {
        rankedLists.push([]);
        relevantLists.push(relevantIds);
      }
      results.push({
        caseId: benchmarkCase.id,
        query: benchmarkCase.query,
        group: benchmarkCase.group,
        labelSource: relevance.labelSource,
        relevantSetSize: relevance.relevantSetSize,
        topKRelevantHits: 0,
        topK: [],
        metrics: zeroQueryMetrics(),
        relevantFound: false,
        clarified: false,
        groupCoverage: 0,
        failureReason: retrievalFailureReason(error),
      });
      continue;
    }

    const ranked = retrieval.results.slice(0, topK);
    const rankedIds = ranked.map((product) => product.productId);
    const topKRelevantHits = rankedIds
      .slice(0, topK)
      .filter((id) => relevantIds.has(id)).length;
    const metrics = {
      'Recall@10': recallAtK(rankedIds, relevantIds, 10),
      'Precision@5': precisionAtK(rankedIds, relevantIds, 5),
      MRR: reciprocalRank(rankedIds, relevantIds),
      'nDCG@10': ndcgAtK(rankedIds, relevantIds, 10),
    };
    const clarified = Boolean(retrieval.clarification?.needed);
    const expectedClarification = benchmarkCase.expectedClarification === true;
    const relevantFound = expectedClarification
      ? clarified
      : metrics['Recall@10'] > 0;
    const groupCoverage = retrieval.groupCoverage?.coverageRate ?? 0;
    const failureReason = expectedClarification
      ? 'Expected clarification was not produced'
      : `No relevant product matched expected categories: ${benchmarkCase.expectedCategories.join(', ')}`;

    const countsTowardRankingMetrics = !expectedClarification;
    if (countsTowardRankingMetrics) {
      rankedLists.push(rankedIds);
      relevantLists.push(relevantIds);
    }
    const result: ProductBenchmarkQueryResult = {
      caseId: benchmarkCase.id,
      query: benchmarkCase.query,
      group: benchmarkCase.group,
      labelSource: relevance.labelSource,
      relevantSetSize: relevance.relevantSetSize,
      topKRelevantHits,
      topK: ranked.map(toTopKProduct),
      metrics,
      relevantFound,
      clarified,
      groupCoverage,
      ...(retrieval.rewrite
        ? { rewrite: toBenchmarkRewriteMetadata(retrieval.rewrite) }
        : {}),
      ...(relevantFound
        ? {}
        : {
            failureReason,
          }),
    };
    results.push(result);
    if (countsTowardRankingMetrics) {
      rankingMetricResults.push(result);
    }
  }

  return {
    summary: {
      'Recall@10': average(
        rankingMetricResults.map((result) => result.metrics['Recall@10']),
      ),
      'Precision@5': average(
        rankingMetricResults.map((result) => result.metrics['Precision@5']),
      ),
      MRR: meanReciprocalRank(rankedLists, relevantLists),
      'nDCG@10': average(
        rankingMetricResults.map((result) => result.metrics['nDCG@10']),
      ),
      'Failure Rate': failureRate(results),
      'Clarification Rate': clarificationRate(results),
      'Group Coverage': average(results.map((result) => result.groupCoverage)),
    },
    results,
    qrelsCoverage: buildQrelsCoverage(cases),
  };
}

export async function runProductRetrievalComparison(
  retriever: ProductRetriever,
  cases: BenchmarkCase[] = productRetrievalBenchmarkCases,
  options: ProductRetrievalBenchmarkOptions = {},
): Promise<ProductRetrievalComparisonReport> {
  const baseline = await runProductRetrievalBenchmark(retriever, cases, {
    ...options,
    pipeline: 'phase-09.2-baseline',
  });
  const improved = await runProductRetrievalBenchmark(retriever, cases, {
    ...options,
    pipeline: 'phase-10-improved',
  });
  const deltas = buildSummaryDeltas(baseline.summary, improved.summary);
  const relativeGate = buildRelativeGate(baseline, improved);

  return {
    benchmarkReport: true,
    baselineVersion: 'phase-09.2',
    improvedVersion: 'phase-10',
    rewriteModel: options.rewriteModel ?? 'deepseek-v4-pro',
    baseline,
    improved,
    deltas,
    relativeGate,
    qrelsCoverage: buildQrelsCoverage(cases),
    failures: collectFailures(baseline, improved),
    secretKeysLogged: false,
  };
}
function buildSummaryDeltas(
  baseline: ProductRetrievalBenchmarkSummary,
  improved: ProductRetrievalBenchmarkSummary,
): ProductRetrievalBenchmarkSummary {
  return {
    'Recall@10': roundMetric(improved['Recall@10'] - baseline['Recall@10']),
    'Precision@5': roundMetric(improved['Precision@5'] - baseline['Precision@5']),
    MRR: roundMetric(improved.MRR - baseline.MRR),
    'nDCG@10': roundMetric(improved['nDCG@10'] - baseline['nDCG@10']),
    'Failure Rate': roundMetric(
      improved['Failure Rate'] - baseline['Failure Rate'],
    ),
    'Clarification Rate': roundMetric(
      improved['Clarification Rate'] - baseline['Clarification Rate'],
    ),
    'Group Coverage': roundMetric(
      improved['Group Coverage'] - baseline['Group Coverage'],
    ),
  };
}

function buildRelativeGate(
  baseline: ProductRetrievalBenchmarkReport,
  improved: ProductRetrievalBenchmarkReport,
): ProductRetrievalComparisonReport['relativeGate'] {
  const checks = {
    recallAt10Improved: improved.summary['Recall@10'] > baseline.summary['Recall@10'],
    mrrImproved: improved.summary.MRR > baseline.summary.MRR,
    ndcgAt10Improved: improved.summary['nDCG@10'] > baseline.summary['nDCG@10'],
    failureRateLower:
      improved.summary['Failure Rate'] < baseline.summary['Failure Rate'],
    keywordRecallNotRegressed:
      groupMetric(improved, 'keyword', 'Recall@10') >=
      groupMetric(baseline, 'keyword', 'Recall@10'),
  };

  return {
    checks,
    passed: Object.values(checks).every(Boolean),
  };
}

function groupMetric(
  report: ProductRetrievalBenchmarkReport,
  group: BenchmarkCase['group'],
  metric: keyof ProductBenchmarkQueryResult['metrics'],
): number {
  const results = report.results.filter((result) => result.group === group);
  return average(results.map((result) => result.metrics[metric]));
}

function collectFailures(
  baseline: ProductRetrievalBenchmarkReport,
  improved: ProductRetrievalBenchmarkReport,
): ProductRetrievalComparisonReport['failures'] {
  return [
    ...baseline.results.map((result) => ({
      result,
      pipeline: 'phase-09.2-baseline' as const,
    })),
    ...improved.results.map((result) => ({
      result,
      pipeline: 'phase-10-improved' as const,
    })),
  ]
    .filter(({ result }) => !result.relevantFound)
    .map(({ result, pipeline }) => ({
      caseId: result.caseId,
      pipeline,
      reason: result.failureReason ?? 'No relevant product found',
    }));
}

function toBenchmarkRewriteMetadata(
  rewrite: NonNullable<ProductRetrievalResult['rewrite']>,
): ProductBenchmarkRewriteMetadata {
  return {
    rewriteProvider: rewrite.metadata.rewrite_provider,
    rewriteModel: rewrite.metadata.rewrite_model,
    rewriteStatus: rewrite.metadata.rewrite_status,
    rewriteRetryCount: rewrite.metadata.rewrite_retry_count,
    rewriteLatencyMs: rewrite.metadata.rewrite_latency_ms,
    rewrittenQuery: rewrite.metadata.rewritten_query,
  };
}

function zeroQueryMetrics(): ProductBenchmarkQueryResult['metrics'] {
  return {
    'Recall@10': 0,
    'Precision@5': 0,
    MRR: 0,
    'nDCG@10': 0,
  };
}

function retrievalFailureReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `Retrieval failed: ${sanitizeFailureMessage(message)}`;
}

function sanitizeFailureMessage(message: string): string {
  const redacted = message
    .replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [redacted]')
    .replace(/\b(sk|or|ds)-[A-Za-z0-9._-]{16,}\b/g, '[redacted]')
    .replace(
      /\b(api[_-]?key|token|authorization)(\s*[:=]\s*)[^\s,;]+/gi,
      '$1$2[redacted]',
    );
  return redacted.length > 300 ? `${redacted.slice(0, 297)}...` : redacted;
}

function buildQrelsCoverage(cases: BenchmarkCase[]): QrelsCoverage {
  return cases.reduce<QrelsCoverage>(
    (coverage, benchmarkCase) => {
      coverage.totalCases += 1;
      if (benchmarkCase.expectedQrels?.length) {
        coverage.manual_binary_qrels += 1;
      } else if (benchmarkCase.expectedProductIds?.length) {
        coverage.expected_product_ids += 1;
      } else if (benchmarkCase.expectedClarification === true) {
        coverage.expected_clarification += 1;
      } else {
        coverage.category_corpus += 1;
        coverage.nonAmbiguousUnlabeled += 1;
      }
      return coverage;
    },
    {
      totalCases: 0,
      manual_binary_qrels: 0,
      expected_product_ids: 0,
      expected_clarification: 0,
      category_corpus: 0,
      nonAmbiguousUnlabeled: 0,
    },
  );
}

function relevanceForCase(
  benchmarkCase: BenchmarkCase,
  relevanceCorpus: ProductSearchPayload[],
): {
  relevantIds: Set<string>;
  labelSource: ProductBenchmarkLabelSource;
  relevantSetSize: number;
} {
  if (benchmarkCase.expectedQrels?.length) {
    const relevantIds = new Set(
      benchmarkCase.expectedQrels.map((qrel) => qrel.productId),
    );
    return {
      relevantIds,
      labelSource: 'manual_binary_qrels',
      relevantSetSize: relevantIds.size,
    };
  }

  if (benchmarkCase.expectedProductIds?.length) {
    const relevantIds = new Set(benchmarkCase.expectedProductIds);
    return {
      relevantIds,
      labelSource: 'expected_product_ids',
      relevantSetSize: relevantIds.size,
    };
  }

  if (benchmarkCase.expectedClarification === true) {
    return {
      relevantIds: new Set(),
      labelSource: 'expected_clarification',
      relevantSetSize: 0,
    };
  }

  const expectedCategories =
    benchmarkCase.expectedCategories.map(normalizeText);
  const relevantIds = new Set(
    relevanceCorpus
      .filter((payload) => matchesExpectedCategory(payload, expectedCategories))
      .map((payload) => payload.productId),
  );
  return {
    relevantIds,
    labelSource: 'category_corpus',
    relevantSetSize: relevantIds.size,
  };
}

function matchesExpectedCategory(
  payload: ProductSearchPayload,
  expectedCategories: string[],
): boolean {
  const categoryText = normalizeText(
    [payload.category, ...payload.categoryPath].join(' '),
  );
  if (expectedCategories.some((category) => categoryText.includes(category))) {
    return true;
  }

  if (!isBroadAccessoryCategory(categoryText)) return false;

  const expectedFamilies = expectedAccessoryFamilies(expectedCategories);
  if (expectedFamilies.length === 0) return false;

  const identityText = normalizeText(
    [
      payload.name,
      ...payload.categoryPath,
      ...(payload.semanticTags ?? []),
      ...(payload.useCases ?? []),
      ...(payload.targetUsers ?? []),
    ].join(' '),
  );
  return expectedFamilies.some(
    (family) =>
      !family.exclusions?.some((alias) => identityTextHasAlias(identityText, alias)) &&
      family.aliases.some((alias) => identityTextHasAlias(identityText, alias)),
  );
}

const ACCESSORY_FAMILY_ALIASES: Array<{
  family: string;
  aliases: string[];
  exclusions?: string[];
}> = [
  { family: 'keyboard', aliases: ['keyboard', 'ban phim'] },
  { family: 'mouse', aliases: ['mouse', 'chuot'] },
  { family: 'webcam', aliases: ['webcam', 'camera stream', 'camera livestream'] },
  {
    family: 'monitor',
    aliases: ['monitor', 'man hinh'],
    exclusions: ['mieng dan man hinh', 'dan man hinh', 'screen protector'],
  },
  { family: 'desk', aliases: ['desk', 'table', 'ban lam viec', 'ban gaming'] },
  { family: 'chair', aliases: ['chair', 'ghe', 'ghe gaming'] },
];

function isBroadAccessoryCategory(categoryText: string): boolean {
  return /(^|[^a-z0-9])(phu kien|accessory|accessories)(?=$|[^a-z0-9])/.test(
    categoryText,
  );
}

function expectedAccessoryFamilies(
  expectedCategories: string[],
): Array<{ family: string; aliases: string[]; exclusions?: string[] }> {
  return ACCESSORY_FAMILY_ALIASES.filter((family) =>
    expectedCategories.some((category) =>
      family.aliases.some((alias) => identityTextHasAlias(category, alias)),
    ),
  );
}

function identityTextHasAlias(text: string, alias: string): boolean {
  const normalizedAlias = normalizeText(alias);
  if (!normalizedAlias) return false;
  return new RegExp(
    `(^|[^a-z0-9])${escapeRegex(normalizedAlias)}(?=$|[^a-z0-9])`,
  ).test(text);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toTopKProduct(
  product: RerankedProductCandidate,
): BenchmarkTopKProduct {
  return {
    productId: product.productId,
    name: product.payload.name,
    category: product.payload.category,
    price:
      product.payload.discountPrice > 0
        ? product.payload.discountPrice
        : product.payload.price,
    stock: product.payload.stock,
    score: product.rerankScore,
    vectorScore: product.score,
    reasons: product.reasons.map((reason) => reason.code),
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return roundMetric(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
}

function roundMetric(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase();
}
