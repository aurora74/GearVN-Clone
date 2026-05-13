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
          categoryHints: expect.arrayContaining(['monitor', 'man hinh']),
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

  it('merges caller constraints with per-group Vietnamese category hints', async () => {
    const retriever = {
      search: jest.fn().mockResolvedValue(buildResult('microphone')),
    };

    const service = new ProductComboRetrievalService();
    await service.searchCombo({
      query: 'goc livestream',
      groups: ['microphone', 'lighting', 'usb-c-hub', 'accessory'],
      constraints: {
        maxPrice: 2_000_000,
        inStockOnly: true,
        categoryHints: ['phu kien'],
        requiredSpecs: { wireless: true },
      },
      retriever,
      perGroupTopK: 2,
    });

    expect(retriever.search).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('microphone'),
      expect.objectContaining({
        constraints: expect.objectContaining({
          maxPrice: 2_000_000,
          inStockOnly: true,
          requiredSpecs: { wireless: true },
          categoryHints: expect.arrayContaining([
            'phu kien',
            'microphone',
            'micro',
            'micro thu am',
          ]),
        }),
      }),
    );
    expect(retriever.search).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('lighting'),
      expect.objectContaining({
        constraints: expect.objectContaining({
          categoryHints: expect.arrayContaining([
            'phu kien',
            'lighting',
            'den led',
            'den livestream',
          ]),
        }),
      }),
    );
    expect(retriever.search).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('usb-c-hub'),
      expect.objectContaining({
        constraints: expect.objectContaining({
          categoryHints: expect.arrayContaining([
            'phu kien',
            'usb-c hub',
            'hub chuyen doi',
            'cong chuyen',
          ]),
        }),
      }),
    );
    expect(retriever.search).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('accessory'),
      expect.objectContaining({
        constraints: expect.objectContaining({
          categoryHints: expect.arrayContaining([
            'phu kien',
            'accessory',
            'phu kien may tinh',
          ]),
        }),
      }),
    );
  });

  it('uses realistic aliases for storage and chair combo groups', async () => {
    const retriever = {
      search: jest.fn().mockResolvedValue(buildResult('chair')),
    };

    const service = new ProductComboRetrievalService();
    await service.searchCombo({
      query: 'setup creator',
      groups: ['storage', 'chair'],
      retriever,
    });

    expect(retriever.search).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      expect.objectContaining({
        constraints: expect.objectContaining({
          categoryHints: expect.arrayContaining(['storage', 'ssd', 'o cung']),
        }),
      }),
    );
    expect(retriever.search).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      expect.objectContaining({
        constraints: expect.objectContaining({
          categoryHints: expect.arrayContaining(['chair', 'ghe', 'ghe gaming']),
        }),
      }),
    );
  });
});
