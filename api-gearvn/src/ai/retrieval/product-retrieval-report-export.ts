import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  ProductRetrievalAblationReport,
  ProductBenchmarkQueryResult,
  ProductRetrievalComparisonReport,
} from './product-retrieval.benchmark';

export type ProductRetrievalReportFormat = 'json' | 'csv' | 'md';

export type ProductRetrievalReportFiles = {
  json?: string;
  csv?: string;
  markdown?: string;
  gate?: string;
};

type RetrievalGateStatus =
  | 'acceptable'
  | 'needs_remediation'
  | 'blocked_incomplete_benchmark';

const EXPECTED_BENCHMARK_CASE_COUNT = 80;

export async function writeProductRetrievalReports(input: {
  reportDir: string;
  comparison: ProductRetrievalComparisonReport;
  formats?: ProductRetrievalReportFormat[];
}): Promise<ProductRetrievalReportFiles> {
  const formats = input.formats ?? ['json', 'csv', 'md'];
  const files: ProductRetrievalReportFiles = {};

  await mkdir(input.reportDir, { recursive: true });

  if (formats.includes('json')) {
    files.json = join(input.reportDir, 'comparison-report.json');
    await writeFile(
      files.json,
      `${JSON.stringify(input.comparison, null, 2)}\n`,
      'utf8',
    );
  }

  if (formats.includes('csv')) {
    files.csv = join(input.reportDir, 'comparison-results.csv');
    await writeFile(files.csv, `${buildComparisonCsv(input.comparison)}\n`, 'utf8');
  }

  if (formats.includes('md')) {
    files.markdown = join(input.reportDir, 'comparison-report.md');
    await writeFile(
      files.markdown,
      `${buildComparisonMarkdown(input.comparison)}\n`,
      'utf8',
    );
  }

  files.gate = join(input.reportDir, 'retrieval-gate.md');
  await writeFile(
    files.gate,
    `${buildRetrievalGateMarkdown(input.comparison)}\n`,
    'utf8',
  );

  return files;
}

export async function writeProductRetrievalAblationReports(input: {
  reportDir: string;
  ablation: ProductRetrievalAblationReport;
  formats?: ProductRetrievalReportFormat[];
}): Promise<ProductRetrievalReportFiles> {
  const formats = input.formats ?? ['json', 'csv', 'md'];
  const files: ProductRetrievalReportFiles = {};

  await mkdir(input.reportDir, { recursive: true });

  if (formats.includes('json')) {
    files.json = join(input.reportDir, 'ablation-report.json');
    await writeFile(
      files.json,
      `${JSON.stringify(input.ablation, null, 2)}\n`,
      'utf8',
    );
  }

  if (formats.includes('csv')) {
    files.csv = join(input.reportDir, 'ablation-results.csv');
    await writeFile(files.csv, `${buildAblationCsv(input.ablation)}\n`, 'utf8');
  }

  if (formats.includes('md')) {
    files.markdown = join(input.reportDir, 'ablation-report.md');
    await writeFile(
      files.markdown,
      `${buildAblationMarkdown(input.ablation)}\n`,
      'utf8',
    );
  }

  return files;
}

export function buildComparisonCsv(
  comparison: ProductRetrievalComparisonReport,
): string {
  const header = [
    'caseId',
    'query',
    'group',
    'labelSource',
    'relevantSetSize',
    'topKRelevantHits',
    'qrelsCoverageManualBinary',
    'qrelsCoverageExpectedProductIds',
    'qrelsCoverageExpectedClarification',
    'qrelsCoverageCategoryCorpus',
    'qrelsCoverageNonAmbiguousUnlabeled',
    'baselineRecallAt10',
    'improvedRecallAt10',
    'baselineMRR',
    'improvedMRR',
    'baselineNdcgAt10',
    'improvedNdcgAt10',
    'baselineFailure',
    'improvedFailure',
    'clarificationNeeded',
    'groupCoverage',
    'rewriteStatus',
    'rewriteLatencyMs',
    'rewriteRetryCount',
    'rewriteModel',
    'baselineFailureNotes',
    'improvedFailureNotes',
  ];
  return [
    header.join(','),
    ...comparison.improved.results.map((improvedResult) => {
      const baselineResult = resultByCaseId(
        comparison.baseline.results,
        improvedResult.caseId,
      );
      return [
        improvedResult.caseId,
        improvedResult.query,
        improvedResult.group,
        improvedResult.labelSource,
        improvedResult.relevantSetSize,
        improvedResult.topKRelevantHits,
        comparison.qrelsCoverage.manual_binary_qrels,
        comparison.qrelsCoverage.expected_product_ids,
        comparison.qrelsCoverage.expected_clarification,
        comparison.qrelsCoverage.category_corpus,
        comparison.qrelsCoverage.nonAmbiguousUnlabeled,
        baselineResult?.metrics['Recall@10'] ?? 0,
        improvedResult.metrics['Recall@10'],
        baselineResult?.metrics.MRR ?? 0,
        improvedResult.metrics.MRR,
        baselineResult?.metrics['nDCG@10'] ?? 0,
        improvedResult.metrics['nDCG@10'],
        String(!baselineResult?.relevantFound),
        String(!improvedResult.relevantFound),
        String(improvedResult.clarified),
        improvedResult.groupCoverage,
        improvedResult.rewrite?.rewriteStatus ?? '',
        improvedResult.rewrite?.rewriteLatencyMs ?? '',
        improvedResult.rewrite?.rewriteRetryCount ?? '',
        improvedResult.rewrite?.rewriteModel ?? '',
        baselineResult?.failureReason ?? '',
        improvedResult.failureReason ?? '',
      ].map(csvCell).join(',');
    }),
  ].join('\n');
}

export function buildComparisonMarkdown(
  comparison: ProductRetrievalComparisonReport,
): string {
  return [
    '# Phase 10 Product Retrieval Comparison',
    '',
    '## Architecture Notes',
    '',
    `- Baseline pipeline: ${comparison.baselineVersion}`,
    `- Improved pipeline: ${comparison.improvedVersion}`,
    `- Rewrite model: ${comparison.rewriteModel}`,
    `- Secret keys logged: ${comparison.secretKeysLogged}`,
    '',
    '## Experiment Design',
    '',
    `- Cases evaluated: ${comparison.improved.results.length}`,
    '- The same teacher-scoped fixtures are run through both retrieval pipelines.',
    '- Metrics include Recall@10, Precision@5, MRR, nDCG@10, Failure Rate, Clarification Rate, and Group Coverage.',
    '- Per-query rows expose labelSource, relevantSetSize, and topKRelevantHits so category-derived labels can be interpreted separately from explicit product IDs.',
    '',
    '### Label Coverage',
    '',
    qrelsCoverageTable(comparison),
    '',
    '## Results',
    '',
    metricTable(comparison),
    '',
    `Relative gate: ${comparison.relativeGate.passed ? 'passed' : 'failed'}`,
    '',
    '## Limitations',
    '',
    '- Report quality depends on the current Qdrant collection and product payload freshness.',
    '- Category-derived relevance labels are stable for comparison but do not replace human graded judgments.',
    '- Live benchmark execution requires configured retrieval service credentials.',
  ].join('\n');
}

export function buildAblationCsv(
  ablation: ProductRetrievalAblationReport,
): string {
  const header = [
    'variant',
    'caseId',
    'query',
    'group',
    'labelSource',
    'relevantSetSize',
    'recallAt10',
    'precisionAt5',
    'mrr',
    'ndcgAt10',
    'relevantFound',
    'clarified',
    'groupCoverage',
    'rewriteStatus',
    'rewriteLatencyMs',
    'failureNotes',
  ];
  const rows = ablation.variantOrder.flatMap((variant) =>
    ablation.variants[variant].results.map((result) =>
      [
        variant,
        result.caseId,
        result.query,
        result.group,
        result.labelSource,
        result.relevantSetSize,
        result.metrics['Recall@10'],
        result.metrics['Precision@5'],
        result.metrics.MRR,
        result.metrics['nDCG@10'],
        String(result.relevantFound),
        String(result.clarified),
        result.groupCoverage,
        result.rewrite?.rewriteStatus ?? '',
        result.rewrite?.rewriteLatencyMs ?? '',
        result.failureReason ?? '',
      ]
        .map(csvCell)
        .join(','),
    ),
  );

  return [header.join(','), ...rows].join('\n');
}

export function buildAblationMarkdown(
  ablation: ProductRetrievalAblationReport,
): string {
  return [
    '# Phase 12 Product Retrieval Ablation',
    '',
    '## Experiment Design',
    '',
    `- Secret keys logged: ${ablation.secretKeysLogged}`,
    `- Variants: ${ablation.variantOrder.join(', ')}`,
    '- Each variant is evaluated with the same benchmark cases, relevance labels, topK, and metric formulas.',
    '- Metrics include Recall@10, Precision@5, MRR, nDCG@10, Failure Rate, Clarification Rate, and Group Coverage.',
    '',
    '### Label Coverage',
    '',
    qrelsCoverageTable(ablation),
    '',
    '## Variant Results',
    '',
    ablationVariantTable(ablation),
    '',
    '## Component Impact',
    '',
    componentImpactTable(ablation),
    '',
    '## Limitations',
    '',
    '- Ablation values are benchmark evidence for thesis reporting and do not change production assistant behavior.',
    '- Report quality depends on the current MongoDB catalog, Qdrant payload freshness, and configured retrieval credentials.',
    '- Missing or timed-out external services should be recorded as blocked-run evidence rather than fabricated metric values.',
  ].join('\n');
}
export function buildRetrievalGateMarkdown(
  comparison: ProductRetrievalComparisonReport,
): string {
  const finalCases = Math.min(
    comparison.baseline.results.length,
    comparison.improved.results.length,
  );
  const selectedCases = selectedCaseCount(comparison, finalCases);
  const improvedFailures = comparison.failures.filter(
    (failure) => failure.pipeline === 'phase-10-improved',
  );
  const status = retrievalGateStatus(comparison, finalCases, improvedFailures.length);
  const lines = [
    '# Retrieval Gate',
    '',
    `Status: ${status}`,
    '',
    `- Secret keys logged: ${comparison.secretKeysLogged}`,
    `- Selected cases: ${selectedCases}`,
    `- Final completed cases: ${finalCases}`,
    `- Expected complete cases: ${EXPECTED_BENCHMARK_CASE_COUNT}`,
    `- Relative gate passed: ${comparison.relativeGate.passed}`,
    `- Improved pipeline failures: ${improvedFailures.length}`,
    '',
    '## Label coverage',
    '',
    qrelsCoverageTable(comparison),
    '',
  ];

  if (finalCases >= EXPECTED_BENCHMARK_CASE_COUNT) {
    lines.push('## Metrics', '', metricTable(comparison), '');
  }

  if (comparison.failures.length > 0) {
    lines.push(
      '## Failures',
      '',
      ...comparison.failures.map(
        (failure) =>
          `- ${failure.pipeline} ${failure.caseId}: ${failure.reason}`,
      ),
      '',
    );
  }

  return lines.join('\n').trimEnd();
}

function retrievalGateStatus(
  comparison: ProductRetrievalComparisonReport,
  finalCases: number,
  improvedFailureCount: number,
): RetrievalGateStatus {
  if (finalCases < EXPECTED_BENCHMARK_CASE_COUNT) {
    return 'blocked_incomplete_benchmark';
  }

  if (comparison.relativeGate.passed && improvedFailureCount === 0) {
    return 'acceptable';
  }

  return 'needs_remediation';
}

function selectedCaseCount(
  comparison: ProductRetrievalComparisonReport,
  fallback: number,
): number {
  const selectedCases = (comparison as ProductRetrievalComparisonReport & {
    selectedCases?: unknown;
  }).selectedCases;

  return typeof selectedCases === 'number' ? selectedCases : fallback;
}

function metricTable(comparison: ProductRetrievalComparisonReport): string {
  const metrics = Object.keys(comparison.improved.summary) as Array<
    keyof ProductRetrievalComparisonReport['improved']['summary']
  >;

  return [
    '| Metric | Baseline | Improved | Delta |',
    '|--------|----------|----------|-------|',
    ...metrics.map(
      (metric) =>
        `| ${metric} | ${comparison.baseline.summary[metric]} | ${comparison.improved.summary[metric]} | ${comparison.deltas[metric]} |`,
    ),
  ].join('\n');
}

function qrelsCoverageTable(
  report: Pick<ProductRetrievalComparisonReport, 'qrelsCoverage'>,
): string {
  const coverage = report.qrelsCoverage;
  return [
    '| Label source | Cases |',
    '|--------------|-------|',
    `| manual_binary_qrels | ${coverage.manual_binary_qrels} |`,
    `| expected_product_ids | ${coverage.expected_product_ids} |`,
    `| expected_clarification | ${coverage.expected_clarification} |`,
    `| category_corpus | ${coverage.category_corpus} |`,
    `| nonAmbiguousUnlabeled | ${coverage.nonAmbiguousUnlabeled} |`,
    `| totalCases | ${coverage.totalCases} |`,
  ].join('\n');
}

function ablationVariantTable(
  ablation: ProductRetrievalAblationReport,
): string {
  const metrics = metricKeys(ablation);
  return [
    '| Variant | ' + metrics.join(' | ') + ' |',
    '|---------|' + metrics.map(() => '--------').join('|') + '|',
    ...ablation.variantOrder.map((variant) => {
      const summary = ablation.variants[variant].summary;
      return `| ${variant} | ${metrics.map((metric) => summary[metric]).join(' | ')} |`;
    }),
  ].join('\n');
}

function componentImpactTable(
  ablation: ProductRetrievalAblationReport,
): string {
  const metrics = metricKeys(ablation);
  return [
    '| Component | ' + metrics.join(' | ') + ' |',
    '|-----------|' + metrics.map(() => '--------').join('|') + '|',
    ...Object.entries(ablation.componentImpact).map(([component, summary]) => {
      return `| ${component} | ${metrics.map((metric) => summary[metric]).join(' | ')} |`;
    }),
  ].join('\n');
}

function metricKeys(
  ablation: ProductRetrievalAblationReport,
): Array<keyof ProductRetrievalAblationReport['variants']['dense_vector_only']['summary']> {
  return Object.keys(
    ablation.variants.dense_vector_only.summary,
  ) as Array<
    keyof ProductRetrievalAblationReport['variants']['dense_vector_only']['summary']
  >;
}

function resultByCaseId(
  results: ProductBenchmarkQueryResult[],
  caseId: string,
): ProductBenchmarkQueryResult | undefined {
  return results.find((result) => result.caseId === caseId);
}

function csvCell(value: unknown): string {
  const text = String(value ?? '');
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}
