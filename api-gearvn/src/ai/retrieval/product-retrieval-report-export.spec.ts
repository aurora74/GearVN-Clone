import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  CHAPTER_4_FINAL_REPORT_DIR,
  DEFAULT_BENCHMARK_REWRITE_TIMEOUT_MS,
  parseArgs,
} from '../../../scripts/benchmark-product-retrieval';
import { ProductRetrievalComparisonReport } from './product-retrieval.benchmark';
import {
  buildComparisonCsv,
  buildComparisonMarkdown,
  buildRetrievalGateMarkdown,
  writeProductRetrievalReports,
} from './product-retrieval-report-export';

describe('product retrieval report export', () => {
  it('builds CSV rows and thesis markdown sections from one comparison object', () => {
    const comparison = comparisonFixture();

    expect(buildComparisonCsv(comparison)).toContain(
      'caseId,query,group,labelSource,relevantSetSize,topKRelevantHits,qrelsCoverageManualBinary,qrelsCoverageExpectedProductIds,qrelsCoverageExpectedClarification,qrelsCoverageCategoryCorpus,qrelsCoverageNonAmbiguousUnlabeled,baselineRecallAt10,improvedRecallAt10,baselineMRR,improvedMRR,baselineNdcgAt10,improvedNdcgAt10,baselineFailure,improvedFailure,clarificationNeeded,groupCoverage,rewriteStatus,rewriteLatencyMs,rewriteRetryCount,rewriteModel,baselineFailureNotes,improvedFailureNotes',
    );
    expect(buildComparisonCsv(comparison)).toContain(
      'case-1,laptop học AI,need_based,expected_product_ids,1,1,0,1,0,0,0,0,1,0,1,0,1,true,false,false,1,success,123,0,deepseek-custom,No relevant product found,',
    );
    expect(buildComparisonMarkdown(comparison)).toEqual(
      expect.stringContaining('## Architecture Notes'),
    );
    expect(buildComparisonMarkdown(comparison)).toEqual(
      expect.stringContaining('## Experiment Design'),
    );
    expect(buildComparisonMarkdown(comparison)).toEqual(
      expect.stringContaining('## Results'),
    );
    expect(buildComparisonMarkdown(comparison)).toEqual(
      expect.stringContaining('| expected_product_ids | 1 |'),
    );
    expect(buildComparisonMarkdown(comparison)).toEqual(
      expect.stringContaining('manual_binary_qrels'),
    );
    expect(buildComparisonMarkdown(comparison)).toEqual(
      expect.stringContaining('## Limitations'),
    );
  });

  it('writes versioned JSON, CSV, and Markdown artifacts', async () => {
    const reportDir = await mkdtemp(join(tmpdir(), 'phase-10-retrieval-'));

    try {
      const files = await writeProductRetrievalReports({
        reportDir,
        comparison: comparisonFixture(),
      });

      expect(files.json).toMatch(/comparison-report\.json$/);
      expect(files.csv).toMatch(/comparison-results\.csv$/);
      expect(files.markdown).toMatch(/comparison-report\.md$/);
      expect(files.gate).toMatch(/retrieval-gate\.md$/);
      await expect(readFile(files.json!, 'utf8')).resolves.toContain(
        '"qrelsCoverage"',
      );
      await expect(readFile(files.json!, 'utf8')).resolves.toContain(
        '"secretKeysLogged": false',
      );
      await expect(readFile(files.csv!, 'utf8')).resolves.toContain('case-1');
      await expect(readFile(files.markdown!, 'utf8')).resolves.toContain(
        'deepseek-custom',
      );
      await expect(readFile(files.gate!, 'utf8')).resolves.toContain(
        'Status: blocked_incomplete_benchmark',
      );
      await expect(readFile(files.gate!, 'utf8')).resolves.toContain(
        'Label coverage',
      );
    } finally {
      await rm(reportDir, { recursive: true, force: true });
    }
  });

  it('parses the fixed Chapter 4 comparison command without loading env files', () => {
    expect(parseArgs([])).toEqual(
      expect.objectContaining({
        mode: 'compare',
        topK: 10,
        reportDir: CHAPTER_4_FINAL_REPORT_DIR,
        formats: ['json', 'csv', 'md'],
        rewriteTimeoutMs: DEFAULT_BENCHMARK_REWRITE_TIMEOUT_MS,
        allowDeterministicShortCircuit: true,
        loadLocalEnv: true,
      }),
    );

    expect(
      parseArgs([
        '--mode=compare',
        '--topK=10',
        '--reportDir=reports/phase-10-retrieval/chapter-4-final',
        '--formats=json,csv,md',
        '--rewriteTimeoutMs=2500',
        '--no-deterministic-short-circuit',
        '--no-load-local-env',
      ]),
    ).toEqual({
      mode: 'compare',
      topK: 10,
      reportDir: 'reports/phase-10-retrieval/chapter-4-final',
      formats: ['json', 'csv', 'md'],
      rewriteTimeoutMs: 2500,
      allowDeterministicShortCircuit: false,
      loadLocalEnv: false,
    });
  });

  it('marks retrieval gate acceptable only for complete passing reports without improved failures', () => {
    const gate = buildRetrievalGateMarkdown(completeComparisonFixture());

    expect(gate).toContain('Status: acceptable');
    expect(gate).toContain('- Secret keys logged: false');
    expect(gate).toContain('- Selected cases: 80');
    expect(gate).toContain('| Metric | Baseline | Improved | Delta |');
  });

  it('marks retrieval gate remediation when complete reports fail the relative gate or improved pipeline', () => {
    expect(
      buildRetrievalGateMarkdown(
        completeComparisonFixture({ relativeGatePassed: false }),
      ),
    ).toContain('Status: needs_remediation');

    const improvedFailureGate = buildRetrievalGateMarkdown(
      completeComparisonFixture({ improvedFailure: true }),
    );
    expect(improvedFailureGate).toContain('Status: needs_remediation');
    expect(improvedFailureGate).toContain('phase-10-improved case-1: Timed out');
  });

  it('marks retrieval gate blocked when fewer than 80 final cases are present', () => {
    const gate = buildRetrievalGateMarkdown(comparisonFixture());

    expect(gate).toContain('Status: blocked_incomplete_benchmark');
    expect(gate).toContain('- Final completed cases: 1');
    expect(gate).not.toContain('## Metrics');
  });
});
function comparisonFixture(): ProductRetrievalComparisonReport {
  const result = {
    caseId: 'case-1',
    query: 'laptop học AI',
    group: 'need_based' as const,
    topK: [],
    labelSource: 'expected_product_ids' as const,
    relevantSetSize: 1,
    topKRelevantHits: 1,
    metrics: {
      'Recall@10': 1,
      'Precision@5': 0.2,
      MRR: 1,
      'nDCG@10': 1,
    },
    relevantFound: true,
    clarified: false,
    groupCoverage: 1,
    rewrite: {
      rewriteProvider: 'deepseek' as const,
      rewriteModel: 'deepseek-custom',
      rewriteStatus: 'success',
      rewriteRetryCount: 0,
      rewriteLatencyMs: 123,
      rewrittenQuery: 'laptop học AI',
    },
  };

  return {
    benchmarkReport: true,
    baselineVersion: 'phase-09.2',
    improvedVersion: 'phase-10',
    rewriteModel: 'deepseek-custom',
    baseline: {
      summary: {
        'Recall@10': 0,
        'Precision@5': 0,
        MRR: 0,
        'nDCG@10': 0,
        'Failure Rate': 1,
        'Clarification Rate': 0,
        'Group Coverage': 0,
      },
      results: [
        {
          ...result,
          metrics: {
            'Recall@10': 0,
            'Precision@5': 0,
            MRR: 0,
            'nDCG@10': 0,
          },
          relevantFound: false,
          failureReason: 'No relevant product found',
        },
      ],
      qrelsCoverage: {
        totalCases: 1,
        manual_binary_qrels: 0,
        expected_product_ids: 1,
        expected_clarification: 0,
        category_corpus: 0,
        nonAmbiguousUnlabeled: 0,
      },
    },
    improved: {
      summary: {
        'Recall@10': 1,
        'Precision@5': 0.2,
        MRR: 1,
        'nDCG@10': 1,
        'Failure Rate': 0,
        'Clarification Rate': 0,
        'Group Coverage': 1,
      },
      results: [result],
      qrelsCoverage: {
        totalCases: 1,
        manual_binary_qrels: 0,
        expected_product_ids: 1,
        expected_clarification: 0,
        category_corpus: 0,
        nonAmbiguousUnlabeled: 0,
      },
    },
    deltas: {
      'Recall@10': 1,
      'Precision@5': 0.2,
      MRR: 1,
      'nDCG@10': 1,
      'Failure Rate': -1,
      'Clarification Rate': 0,
      'Group Coverage': 1,
    },
    relativeGate: {
      passed: true,
      checks: {
        recallAt10Improved: true,
        mrrImproved: true,
        ndcgAt10Improved: true,
        failureRateLower: true,
        keywordRecallNotRegressed: true,
      },
    },
    qrelsCoverage: {
      totalCases: 1,
      manual_binary_qrels: 0,
      expected_product_ids: 1,
      expected_clarification: 0,
      category_corpus: 0,
      nonAmbiguousUnlabeled: 0,
    },
    failures: [],
    secretKeysLogged: false,
  };
}

function completeComparisonFixture(
  options: { relativeGatePassed?: boolean; improvedFailure?: boolean } = {},
): ProductRetrievalComparisonReport & { selectedCases: number } {
  const comparison = comparisonFixture() as ProductRetrievalComparisonReport & {
    selectedCases: number;
  };
  comparison.selectedCases = 80;
  comparison.baseline.results = Array.from({ length: 80 }, (_, index) => ({
    ...comparison.baseline.results[0],
    caseId: `case-${index + 1}`,
  }));
  comparison.improved.results = Array.from({ length: 80 }, (_, index) => ({
    ...comparison.improved.results[0],
    caseId: `case-${index + 1}`,
  }));

  if (options.relativeGatePassed === false) {
    comparison.relativeGate = {
      ...comparison.relativeGate,
      passed: false,
      checks: {
        ...comparison.relativeGate.checks,
        recallAt10Improved: false,
      },
    };
  }

  if (options.improvedFailure) {
    comparison.failures = [
      {
        caseId: 'case-1',
        pipeline: 'phase-10-improved',
        reason: 'Timed out',
      },
    ];
  }

  return comparison;
}
