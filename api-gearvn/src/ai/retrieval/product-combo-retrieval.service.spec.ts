import { comboGroupsFromIntentPrimitives } from './product-intent-primitives';
import { ProductComboRetrievalService } from './product-combo-retrieval.service';
import { ProductRetrievalResult } from './product-retrieval.types';

describe('ProductComboRetrievalService', () => {
  const buildResult = (productId: string): ProductRetrievalResult => ({
    query: {
      original: productId,
      expanded: [],
      expandedText: productId,
      constraints: {},
    },
    candidates: [],
    results: [
      {
        productId,
        score: 0.8,
        rerankScore: 4,
        reasons: [],
        payload: {
          productId,
          name: productId,
          slug: productId,
          category: 'Accessory',
          categoryPath: ['Accessory'],
          price: 1_000_000,
          discountPrice: 900_000,
          stock: 3,
          isPublished: true,
          isArchived: false,
          semanticTags: [],
          useCases: [],
          targetUsers: [],
        },
      },
    ],
  });

  it('uses work-from-home primitive groups and calls the retriever once per group', async () => {
    const groups = comboGroupsFromIntentPrimitives('setup làm việc tại nhà');
    const retriever = {
      search: jest.fn().mockImplementation((query: string) => {
        if (query.includes('webcam')) {
          return Promise.resolve({ ...buildResult('webcam'), results: [] });
        }

        return Promise.resolve(buildResult(query));
      }),
    };

    const service = new ProductComboRetrievalService();
    const result = await service.searchCombo({
      query: 'setup làm việc tại nhà',
      groups,
      retriever,
      perGroupTopK: 7,
    });

    expect(groups).toEqual(
      expect.arrayContaining(['monitor', 'keyboard', 'mouse', 'webcam']),
    );
    expect(retriever.search).toHaveBeenCalledTimes(groups.length);
    expect(retriever.search).toHaveBeenCalledWith(
      expect.stringContaining('monitor'),
      expect.objectContaining({
        topK: 3,
        constraints: expect.objectContaining({
          categoryHints: ['monitor'],
        }),
        pipeline: 'phase-09.2-baseline',
      }),
    );
    expect(result.groupCoverage.expectedGroups).toEqual(groups);
    expect(result.groupCoverage.coveredGroups).toEqual(
      expect.arrayContaining(['monitor', 'keyboard', 'mouse']),
    );
    expect(result.groupCoverage.missingGroups).toContain('webcam');
    expect(result.groupCoverage.coverageRate).toBeCloseTo(
      result.groupCoverage.coveredGroups.length / groups.length,
    );
  });

  it('clamps per-group retrieval size to at least one card', async () => {
    const retriever = {
      search: jest.fn().mockResolvedValue(buildResult('monitor')),
    };

    const service = new ProductComboRetrievalService();
    await service.searchCombo({
      query: 'setup làm việc tại nhà',
      groups: ['monitor'],
      retriever,
      perGroupTopK: 0,
    });

    expect(retriever.search).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ topK: 1 }),
    );
  });
});
