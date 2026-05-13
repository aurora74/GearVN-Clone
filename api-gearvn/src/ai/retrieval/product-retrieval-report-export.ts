import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  ProductBenchmarkQueryResult,
  ProductRetrievalComparisonReport,
} from './product-retrieval.benchmark';

export type ProductRetrievalReportFormat = 'json' | 'csv' | 'md';

export type ProductRetrievalReportFiles = {
  json?: string;
  csv?: string;
  markdown?: string;
};

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

  return files;
}

export function buildComparisonCsv(
  comparison: ProductRetrievalComparisonReport,
): string {
  const header = [
    'caseId',
    'query',
    'group',
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
    'failureNotes',
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
        baselineResult?.failureReason ?? improvedResult.failureReason ?? '',
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
