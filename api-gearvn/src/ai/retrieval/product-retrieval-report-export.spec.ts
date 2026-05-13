import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ProductRetrievalComparisonReport } from './product-retrieval.benchmark';
import {
  buildComparisonCsv,
  buildComparisonMarkdown,
  writeProductRetrievalReports,
} from './product-retrieval-report-export';

describe('product retrieval report export', () => {
  it('builds CSV rows and thesis markdown sections from one comparison object', () => {
    const comparison = comparisonFixture();

    expect(buildComparisonCsv(comparison)).toContain(
      'caseId,query,group,baselineRecallAt10,improvedRecallAt10,baselineMRR,improvedMRR,baselineNdcgAt10,improvedNdcgAt10,baselineFailure,improvedFailure,clarificationNeeded,groupCoverage,failureNotes',
    );
    expect(buildComparisonCsv(comparison)).toContain(
      'case-1,laptop học AI,need_based,0,1,0,1,0,1,true,false,false,1,',
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
      await expect(readFile(files.json!, 'utf8')).resolves.toContain(
        '"secretKeysLogged": false',
      );
      await expect(readFile(files.csv!, 'utf8')).resolves.toContain('case-1');
      await expect(readFile(files.markdown!, 'utf8')).resolves.toContain(
        'deepseek-custom',
      );
    } finally {
      await rm(reportDir, { recursive: true, force: true });
    }
  });
});

function comparisonFixture(): ProductRetrievalComparisonReport {
  const result = {
    caseId: 'case-1',
    query: 'laptop học AI',
    group: 'need_based' as const,
    topK: [],
    metrics: {
      'Recall@10': 1,
      'Precision@5': 0.2,
      MRR: 1,
      'nDCG@10': 1,
    },
    relevantFound: true,
    clarified: false,
    groupCoverage: 1,
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
    failures: [],
    secretKeysLogged: false,
  };
}
