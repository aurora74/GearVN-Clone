import { ProductRetriever } from './product-retriever';
import {
  BenchmarkCase,
  ProductRetrievalConstraints,
  ProductRetrievalPipelineMode,
  ProductRetrievalResult,
  ProductSearchPayload,
  RerankedProductCandidate,
} from './product-retrieval.types';
import { productRetrievalBenchmarkCases } from './product-retrieval.benchmark-cases';

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

export type ProductBenchmarkQueryResult = {
  caseId: string;
  query: string;
  group: BenchmarkCase['group'];
  topK: BenchmarkTopKProduct[];
  metrics: Record<'Recall@10' | 'Precision@5' | 'MRR' | 'nDCG@10', number>;
  relevantFound: boolean;
  clarified: boolean;
  groupCoverage: number;
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

export type ProductRetrievalBenchmarkReport = {
  summary: ProductRetrievalBenchmarkSummary;
  results: ProductBenchmarkQueryResult[];
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
};
type BenchmarkSearchOptions = {
  topK: number;
  filters?: ProductRetrievalConstraints;
  hardConstraints?: ProductRetrievalConstraints;
  pipeline?: ProductRetrievalPipelineMode;
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

  for (const benchmarkCase of cases) {
    const searchOptions: BenchmarkSearchOptions = {
      topK,
      pipeline: options.pipeline,
    };
    if (benchmarkCase.hardConstraints) {
      searchOptions.filters = benchmarkCase.hardConstraints;
      searchOptions.hardConstraints = benchmarkCase.hardConstraints;
    }

    const retrieval: ProductRetrievalResult = await retriever.search(
      benchmarkCase.query,
      searchOptions,
    );
    const ranked = retrieval.results.slice(0, topK);
    const rankedIds = ranked.map((product) => product.productId);
    const relevantIds = relevantSetForCase(
      benchmarkCase,
      options.relevanceCorpus ?? [],
    );
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

    rankedLists.push(rankedIds);
    relevantLists.push(relevantIds);
    results.push({
      caseId: benchmarkCase.id,
      query: benchmarkCase.query,
      group: benchmarkCase.group,
      topK: ranked.map(toTopKProduct),
      metrics,
      relevantFound,
      clarified,
      groupCoverage,
      ...(relevantFound
        ? {}
        : {
            failureReason,
          }),
    });
  }

  return {
    summary: {
      'Recall@10': average(
        results.map((result) => result.metrics['Recall@10']),
      ),
      'Precision@5': average(
        results.map((result) => result.metrics['Precision@5']),
      ),
      MRR: meanReciprocalRank(rankedLists, relevantLists),
      'nDCG@10': average(results.map((result) => result.metrics['nDCG@10'])),
      'Failure Rate': failureRate(results),
      'Clarification Rate': clarificationRate(results),
      'Group Coverage': average(results.map((result) => result.groupCoverage)),
    },
    results,
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

function relevantSetForCase(
  benchmarkCase: BenchmarkCase,
  relevanceCorpus: ProductSearchPayload[],
): Set<string> {
  if (benchmarkCase.expectedProductIds?.length) {
    return new Set(benchmarkCase.expectedProductIds);
  }

  const expectedCategories =
    benchmarkCase.expectedCategories.map(normalizeText);
  return new Set(
    relevanceCorpus
      .filter((payload) => matchesExpectedCategory(payload, expectedCategories))
      .map((payload) => payload.productId),
  );
}

function matchesExpectedCategory(
  payload: ProductSearchPayload,
  expectedCategories: string[],
): boolean {
  const categoryText = normalizeText(
    [payload.category, ...payload.categoryPath].join(' '),
  );
  return expectedCategories.some((category) => categoryText.includes(category));
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
