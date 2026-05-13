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

  it('isolates caller category hints from per-group Vietnamese category hints', async () => {
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
          categoryHints: expect.arrayContaining([
            'microphone',
            'micro',
            'micro thu am',
          ]),
        }),
      }),
    );
    expect(
      retriever.search.mock.calls[0][1].constraints.categoryHints,
    ).not.toContain('phu kien');
    expect(retriever.search.mock.calls[0][1].constraints.requiredSpecs).toEqual(
      {},
    );
    expect(retriever.search).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('lighting'),
      expect.objectContaining({
        constraints: expect.objectContaining({
          categoryHints: expect.arrayContaining([
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
            'accessory',
            'phu kien may tinh',
          ]),
        }),
      }),
    );
  });
  it('maps explicit PC desk chair livestream combo text to canonical setup slots', () => {
    const groups = comboGroupsFromIntentPrimitives(
      'combo pc, bàn, ghế phục vụ livestream',
    );

    expect(groups).toEqual(
      expect.arrayContaining([
        'desktop_pc',
        'desk',
        'chair',
        'webcam',
        'microphone',
      ]),
    );
    expect(groups).not.toContain('phone');
    expect(groups).not.toContain('cpu');
  });
  it('cap-protects explicitly requested PC desk and chair before optional livestream groups', async () => {
    const retriever = {
      search: jest.fn().mockResolvedValue(buildResult('group')),
    };
    const service = new ProductComboRetrievalService();

    const result = await service.searchCombo({
      query: 'combo pc, bàn, ghế phục vụ livestream',
      groups: [
        'webcam',
        'microphone',
        'lighting',
        'headset',
        'monitor',
        'desktop_pc',
        'desk',
        'chair',
      ],
      retriever,
      maxGroups: 6,
    });

    expect(result.groups.map((group) => group.id)).toEqual([
      'desktop_pc',
      'desk',
      'chair',
      'webcam',
      'microphone',
      'lighting',
    ]);
    expect(retriever.search).toHaveBeenCalledWith(
      expect.stringContaining('desk'),
      expect.anything(),
    );
    expect(retriever.search).toHaveBeenCalledWith(
      expect.stringContaining('chair'),
      expect.anything(),
    );
  });
  it('filters invalid provider combo groups and defaults combo retrieval to in-stock', async () => {
    const retriever = {
      search: jest.fn().mockResolvedValue(buildResult('desktop_pc')),
    };
    const service = new ProductComboRetrievalService();

    const result = await service.searchCombo({
      query: 'combo pc bàn ghế livestream',
      groups: ['desktop_pc', 'desk', 'chair', 'phone' as any],
      constraints: { categoryHints: ['pc'] },
      retriever,
    });

    expect(result.groupCoverage.expectedGroups).toEqual([
      'desktop_pc',
      'desk',
      'chair',
    ]);
    expect(retriever.search).toHaveBeenCalledTimes(3);
    expect(retriever.search).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('desktop_pc'),
      expect.objectContaining({
        constraints: expect.objectContaining({
          categoryHints: expect.arrayContaining(['desktop_pc']),
        }),
      }),
    );
    expect(
      retriever.search.mock.calls[0][1].constraints.categoryHints,
    ).not.toContain('pc');
    expect(retriever.search).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('desk'),
      expect.objectContaining({
        constraints: expect.objectContaining({
          inStockOnly: true,
          categoryHints: expect.arrayContaining(['desk', 'ban-ghe-gaming']),
        }),
      }),
    );
    expect(
      retriever.search.mock.calls[1][1].constraints.categoryHints,
    ).not.toContain('pc');
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
  it('runs combo group searches concurrently and returns partial results inside the budget', async () => {
    let now = 0;
    const dateSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
    try {
      const service = new ProductComboRetrievalService();
      const pendingSearches: Array<() => void> = [];
      const retriever = {
        search: jest.fn().mockImplementation((query: string) => {
          const group = query.split(' ').at(-1) ?? query;
          return new Promise<ProductRetrievalResult>((resolve) => {
            pendingSearches.push(() => resolve(buildResult(group)));
          });
        }),
      };

      const pending = service.searchCombo({
        query: 'setup livestream',
        groups: [
          'webcam',
          'microphone',
          'lighting',
          'headset',
          'monitor',
          'keyboard',
        ],
        retriever,
        concurrency: 2,
        maxDurationMs: 35,
        maxGroups: 6,
      });
      await Promise.resolve();

      expect(retriever.search).toHaveBeenCalledTimes(2);
      now = 25;
      pendingSearches.splice(0).forEach((resolve) => resolve());
      await Promise.resolve();
      const result = await pending;

      expect(retriever.search).toHaveBeenCalledTimes(4);
      expect(result.groups.map((group) => group.id)).toEqual([
        'webcam',
        'microphone',
      ]);
      expect(result.groupCoverage.missingGroups).toEqual(
        expect.arrayContaining(['lighting', 'headset', 'monitor', 'keyboard']),
      );
    } finally {
      dateSpy.mockRestore();
    }
  });

  it('prioritizes livestream setup core groups and caps broad workspace peripherals', async () => {
    const service = new ProductComboRetrievalService();
    const retriever = {
      search: jest.fn().mockResolvedValue(buildResult('group')),
    };

    const result = await service.searchCombo({
      query: 'mình cần tư vấn setup góc làm việc cho livestream',
      groups: [
        'monitor',
        'keyboard',
        'mouse',
        'webcam',
        'usb-c-hub',
        'microphone',
        'lighting',
        'headset',
      ],
      retriever,
    });

    expect(result.groupCoverage.expectedGroups).toEqual([
      'webcam',
      'microphone',
      'lighting',
      'headset',
      'monitor',
      'keyboard',
      'mouse',
      'usb-c-hub',
    ]);
    expect(result.groups.map((group) => group.id)).toEqual([
      'webcam',
      'microphone',
      'lighting',
      'headset',
      'monitor',
      'keyboard',
    ]);
    expect(retriever.search).not.toHaveBeenCalledWith(
      expect.stringContaining('usb-c-hub'),
      expect.anything(),
    );
  });
});
