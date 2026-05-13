import { ProductRetriever } from '../../retrieval/product-retriever';
import { ProductRetrievalResult } from '../../retrieval/product-retrieval.types';
import {
  parseRequestedRecommendationLimit,
  productAdviceNode,
  ProductCatalogAdapter,
} from './product-advice.node';
import { readAssistantRecommendationConfig } from '../config/assistant-recommendation.config';

const catalogSnapshots = [
  {
    productId: '64f100000000000000000001',
    name: 'Laptop Gaming RTX 4060',
    price: 24_990_000,
    stock: 4,
    slug: 'laptop-gaming-rtx-4060',
    image: 'https://cdn.gearvn.test/laptop-4060.jpg',
    searchMetadata: {
      specsSummary: 'RTX 4060, RAM 16GB, SSD 512GB',
    },
  },
  {
    productId: '64f100000000000000000002',
    name: 'Laptop Creator OLED',
    price: 27_490_000,
    stock: 2,
    slug: 'laptop-creator-oled',
    image: 'https://cdn.gearvn.test/creator-oled.jpg',
    searchMetadata: {
      specsSummary: 'OLED, RAM 16GB, SSD 1TB',
    },
  },
  {
    productId: '64f100000000000000000003',
    name: 'Laptop Student Ryzen',
    price: 16_990_000,
    stock: 0,
    slug: 'laptop-student-ryzen',
    image: 'https://cdn.gearvn.test/student-ryzen.jpg',
    searchMetadata: {},
  },
  {
    productId: '64f100000000000000000004',
    name: 'Laptop Office Intel',
    price: 18_490_000,
    stock: 8,
    slug: 'laptop-office-intel',
    image: 'https://cdn.gearvn.test/office-intel.jpg',
    searchMetadata: {},
  },
  {
    productId: '64f100000000000000000005',
    name: 'Laptop Thin Light',
    price: 21_490_000,
    stock: 3,
    slug: 'laptop-thin-light',
    image: 'https://cdn.gearvn.test/thin-light.jpg',
    searchMetadata: {},
  },
  {
    productId: '64f100000000000000000006',
    name: 'Laptop Business 14',
    price: 19_990_000,
    stock: 6,
    slug: 'laptop-business-14',
    image: 'https://cdn.gearvn.test/business-14.jpg',
    searchMetadata: {},
  },
  {
    productId: '64f100000000000000000007',
    name: 'Laptop Gaming Entry',
    price: 22_990_000,
    stock: 5,
    slug: 'laptop-gaming-entry',
    image: 'https://cdn.gearvn.test/gaming-entry.jpg',
    searchMetadata: {},
  },
];

const retrievalResult: ProductRetrievalResult = {
  query: {
    original: 'laptop gaming tam 25 trieu',
    expanded: ['laptop gaming', 'rtx 4060'],
    expandedText: 'laptop gaming tam 25 trieu rtx 4060',
    constraints: {
      categoryHints: ['laptop'],
      maxPrice: 25_000_000,
      requiredSpecs: { ramGb: 16 },
    },
  },
  candidates: [],
  results: catalogSnapshots.map((snapshot, index) => ({
    productId: snapshot.productId,
    score: 0.9 - index * 0.05,
    rerankScore: 90 - index,
    reasons: [
      {
        code: 'need_match',
        message: `Phu hop nhu cau ${index + 1}`,
        weight: 12,
      },
    ],
    payload: {
      productId: snapshot.productId,
      name: snapshot.name,
      slug: snapshot.slug,
      category: 'laptop',
      categoryPath: ['Laptop'],
      price: snapshot.price,
      discountPrice: snapshot.price,
      stock: snapshot.stock,
      isPublished: true,
      isArchived: false,
      semanticTags: ['gaming'],
      useCases: ['gaming'],
      targetUsers: ['student'],
      normalizedSpecs: snapshot.searchMetadata,
    },
  })),
};

const GENERIC_PRODUCT_CARDS_TEXT =
  'Mình đã gửi các lựa chọn khớp nhất vào thẻ sản phẩm bên dưới để bạn xem nhanh.';

function expectDataDrivenProductAdviceFallback(text: string): void {
  expect(text).not.toBe(GENERIC_PRODUCT_CARDS_TEXT);
  expect(text).toContain('thẻ sản phẩm');
  expect(text).toMatch(/[.!?]$/);
}

describe('readAssistantRecommendationConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses bounded defaults and clamps configured recommendation limits', () => {
    process.env.ASSISTANT_RECOMMENDATION_DEFAULT_LIMIT = '0';
    process.env.ASSISTANT_RECOMMENDATION_MORE_OPTIONS_LIMIT = '20';
    process.env.ASSISTANT_RECOMMENDATION_MAX_LIMIT = '15';

    expect(readAssistantRecommendationConfig()).toEqual({
      defaultLimit: 1,
      moreOptionsLimit: 12,
      maxLimit: 12,
    });
  });
});

describe('parseRequestedRecommendationLimit', () => {
  it.each([
    ['gợi ý 5 mẫu laptop', 5],
    ['cho mình 7 sản phẩm', 7],
    ['recommend 4 con', 4],
    ['đề xuất 6 mẫu', 6],
  ])('parses explicit product-count wording from "%s"', (text, expected) => {
    expect(parseRequestedRecommendationLimit(text)).toBe(expected);
  });

  it.each([
    'gợi ý 0 mẫu laptop',
    'recommend -3 con',
    'abc 8 xyz',
    'mình cần laptop',
  ])('ignores invalid or noisy counts from "%s"', (text) => {
    expect(parseRequestedRecommendationLimit(text)).toBeNull();
  });
});

describe('productAdviceNode', () => {
  const productRetriever = {
    search: jest.fn<Promise<ProductRetrievalResult>, [string, unknown]>(),
  } as unknown as jest.Mocked<ProductRetriever>;

  const catalogAdapter = {
    getSnapshotsByIds: jest.fn(),
  } as unknown as jest.Mocked<ProductCatalogAdapter>;

  beforeEach(() => {
    jest.clearAllMocks();
    productRetriever.search.mockResolvedValue(retrievalResult);
    catalogAdapter.getSnapshotsByIds.mockResolvedValue(catalogSnapshots);
  });

  it('CHAT-02 D-12 calls ProductRetriever.search immediately for product-seeking text', async () => {
    const result = await productAdviceNode(
      {
        userText: 'Can tu van laptop gaming tam 25 trieu',
        intentPlan: { needsProductRetrieval: true, broadNeed: false },
      },
      { productRetriever, catalogAdapter },
    );

    expect(productRetriever.search).toHaveBeenCalledWith(
      'Can tu van laptop gaming tam 25 trieu',
      expect.objectContaining({ topK: 3 }),
    );
  });

  it('Phase 10 calls improved retrieval with rewrite context for product advice', async () => {
    const abortController = new AbortController();

    const result = await productAdviceNode(
      {
        userText: 'Can tu van laptop gaming tam 25 trieu',
        intentPlan: {
          needsProductRetrieval: true,
          broadNeed: false,
          contextualUserText: 'laptop gaming 25 triệu ưu tiên RTX',
        },
      },
      { productRetriever, catalogAdapter, abortSignal: abortController.signal },
    );

    expect(productRetriever.search).toHaveBeenCalledWith(
      'laptop gaming 25 triệu ưu tiên RTX',
      expect.objectContaining({
        topK: 3,
        pipeline: 'phase-10-improved',
        rewriteContext: expect.objectContaining({
          originalQuery: 'Can tu van laptop gaming tam 25 trieu',
          clarificationAnswer: 'laptop gaming 25 triệu ưu tiên RTX',
          signal: abortController.signal,
          timeoutMs: 12_000,
          allowDeterministicShortCircuit: true,
        }),
      }),
    );
  });

  it('Phase 10 treats laptop advice follow-up for Machine Learning as single-category advice', async () => {
    const result = await productAdviceNode(
      {
        userText: '30 triệu đổ xuống để học Machine Learning',
        intentPlan: {
          needsProductRetrieval: true,
          broadNeed: false,
          contextualUserText:
            'tư vấn laptop 30 triệu đổ xuống để học Machine Learning',
        },
      },
      { productRetriever, catalogAdapter },
    );

    expect(productRetriever.search).toHaveBeenCalledWith(
      expect.stringContaining(
        'tư vấn laptop 30 triệu đổ xuống để học Machine Learning',
      ),
      expect.objectContaining({
        pipeline: 'phase-10-improved',
        rewriteContext: expect.objectContaining({
          originalQuery: '30 triệu đổ xuống để học Machine Learning',
          clarificationAnswer:
            'tư vấn laptop 30 triệu đổ xuống để học Machine Learning',
          allowDeterministicShortCircuit: true,
        }),
      }),
    );
    expect(result.metadata.productGroups).toBeUndefined();
    expect(result.text).not.toContain('nhóm sản phẩm');
    expect(result.text).not.toContain('ráp một bộ');
  });
  it('returns product cards with fallback metadata when LLM composition times out', async () => {
    let composeSignal: AbortSignal | undefined;
    const responseComposer = {
      composeProductAdvice: jest.fn((input) => {
        composeSignal = input.signal;
        return new Promise<string>(() => undefined);
      }),
    };

    const startedAt = Date.now();
    const result = await productAdviceNode(
      {
        userText: 'laptop 30 triệu đổ xuống, dùng để học AI/Machine Learning',
        intentPlan: { needsProductRetrieval: true, broadNeed: false },
      },
      {
        productRetriever,
        catalogAdapter,
        responseComposer: responseComposer as any,
        composeTimeoutMs: 5,
      },
    );

    expect(Date.now() - startedAt).toBeLessThan(1_000);
    expect(responseComposer.composeProductAdvice).toHaveBeenCalled();
    expect(composeSignal?.aborted).toBe(true);
    expect(result.metadata.productCards).toHaveLength(3);
    expect(result.metadata.llmComposed).toBe(false);
    expect(result.metadata.llmComposeStatus).toBe('fallback');
    expect(result.metadata.llmComposeFallbackReason).toBe('composer_timeout');
    expect(result.text).toContain('thẻ sản phẩm bên dưới');
  });

  it('passes prior recommendations to composer for constraint refinement follow-ups', async () => {
    const sessionService = {
      getLastRecommendationLedger: jest.fn().mockResolvedValue([
        {
          rank: 1,
          productId: '64f100000000000000000001',
          name: 'Laptop Gaming RTX 4060',
          slug: 'laptop-gaming-rtx-4060',
          category: 'Laptop',
          price: 24_990_000,
          discountPrice: 24_990_000,
          stock: 4,
          specsSummary: 'RTX 4060, RAM 16GB',
          createdAt: new Date('2026-05-13T00:00:00.000Z'),
        },
      ]),
      saveRecommendationLedger: jest.fn(),
    };
    const responseComposer = {
      composeProductAdvice: jest
        .fn()
        .mockResolvedValue(
          'Mình sẽ lọc lại theo ưu tiên mới và so với lựa chọn trước đó.',
        ),
    };

    const result = await productAdviceNode(
      {
        roomId: 'room-refinement-context',
        userText: 'ưu tiên máy nhẹ hơn để mang đi học',
        parsedEntities: {
          productCategory: 'laptop',
          contextResolutionReason: 'shopping_constraint_continuation',
        },
        intentPlan: {
          needsProductRetrieval: true,
          broadNeed: false,
          contextualUserText:
            'laptop 25 triệu học AI ưu tiên máy nhẹ hơn để mang đi học',
          contextResolutionReason: 'shopping_constraint_continuation',
        },
      },
      {
        productRetriever,
        catalogAdapter,
        responseComposer: responseComposer as any,
        sessionService: sessionService as any,
      },
    );

    expect(sessionService.getLastRecommendationLedger).toHaveBeenCalledWith(
      'room-refinement-context',
    );
    expect(
      sessionService.getLastRecommendationLedger.mock.invocationCallOrder[0],
    ).toBeLessThan(productRetriever.search.mock.invocationCallOrder[0]);
    expect(responseComposer.composeProductAdvice).toHaveBeenCalledWith(
      expect.objectContaining({
        consultationMode: 'refinement',
        preferenceDelta: 'ưu tiên máy nhẹ hơn để mang đi học',
        priorRecommendations: [
          expect.objectContaining({
            productId: '64f100000000000000000001',
            specsSummary: 'RTX 4060, RAM 16GB',
          }),
        ],
      }),
    );
    expect(result.text).toContain('ưu tiên mới');
    expect(result.metadata).toMatchObject({
      consultationMode: 'refinement',
      priorRecommendationProductIds: ['64f100000000000000000001'],
      recommendationContinuity: expect.objectContaining({
        mode: 'refinement',
        hasPriorRecommendations: true,
        priorRecommendationProductIds: ['64f100000000000000000001'],
      }),
      llmComposed: true,
      llmComposeStatus: 'used',
    });
  });

  it('uses continuity fallback and preserves prior ledger when refinement composer returns empty', async () => {
    const priorLedger = [
      {
        rank: 1,
        productId: '64f100000000000000000001',
        name: 'Laptop Prior Lead',
        slug: 'laptop-prior-lead',
        category: 'Laptop',
        price: 24_990_000,
        discountPrice: 24_490_000,
        stock: 4,
        specsSummary: 'GPU rời, RAM 16GB',
        createdAt: new Date('2026-05-13T00:00:00.000Z'),
      },
      {
        rank: 2,
        productId: '64f100000000000000000002',
        name: 'Laptop Prior Second',
        slug: 'laptop-prior-second',
        category: 'Laptop',
        price: 25_990_000,
        discountPrice: 25_490_000,
        stock: 3,
        specsSummary: 'RAM 16GB, SSD 1TB',
        createdAt: new Date('2026-05-13T00:00:00.000Z'),
      },
      {
        rank: 3,
        productId: '64f100000000000000000003',
        name: 'Laptop Prior Third',
        slug: 'laptop-prior-third',
        category: 'Laptop',
        price: 22_990_000,
        discountPrice: 22_490_000,
        stock: 2,
        specsSummary: 'Màn hình 15 inch',
        createdAt: new Date('2026-05-13T00:00:00.000Z'),
      },
    ];
    const sessionService = {
      getLastRecommendationLedger: jest.fn().mockResolvedValue(priorLedger),
      saveRecommendationLedger: jest.fn(),
    };
    const responseComposer = {
      composeProductAdvice: jest.fn().mockResolvedValue(null),
    };
    const freshIds = [
      '64f100000000000000000002',
      '64f100000000000000000003',
      '64f100000000000000000004',
    ];
    productRetriever.search.mockResolvedValueOnce({
      ...retrievalResult,
      query: { ...retrievalResult.query, constraints: {} },
      results: retrievalResult.results.filter((result) =>
        freshIds.includes(result.productId),
      ),
    });

    const result = await productAdviceNode(
      {
        roomId: 'room-refinement-empty-compose',
        userText: 'ưu tiên cấu hình mạnh hơn',
        parsedEntities: {
          productCategory: 'laptop',
          contextResolutionReason: 'shopping_constraint_continuation',
        },
        intentPlan: {
          needsProductRetrieval: true,
          broadNeed: false,
          contextualUserText: 'laptop học AI ưu tiên cấu hình mạnh hơn',
          contextResolutionReason: 'shopping_constraint_continuation',
        },
      },
      {
        productRetriever,
        catalogAdapter,
        responseComposer: responseComposer as any,
        sessionService: sessionService as any,
      },
    );

    expect(result.text).not.toBe(
      'Mình đã gửi các lựa chọn khớp nhất vào thẻ sản phẩm bên dưới để bạn xem nhanh.',
    );
    expect(result.text).toContain('Laptop Prior Lead');
    expect(result.metadata.productCards.map((card) => card.productId)).toEqual([
      '64f100000000000000000001',
      '64f100000000000000000002',
      '64f100000000000000000003',
      '64f100000000000000000004',
    ]);
    expect(result.metadata).toMatchObject({
      consultationMode: 'refinement',
      llmComposed: false,
      llmComposeStatus: 'fallback',
      llmComposeFallbackReason: 'composer_returned_empty',
      priorRecommendationProductIds: [
        '64f100000000000000000001',
        '64f100000000000000000002',
        '64f100000000000000000003',
      ],
      comparedProductIds: [
        '64f100000000000000000001',
        '64f100000000000000000002',
        '64f100000000000000000003',
        '64f100000000000000000004',
      ],
    });
    expect(sessionService.saveRecommendationLedger).not.toHaveBeenCalled();
  });
  it('uses alternative-card fallback for more-options when composer returns empty', async () => {
    const priorLedger = [
      {
        rank: 1,
        productId: '64f100000000000000000001',
        name: 'Laptop Prior Lead',
        slug: 'laptop-prior-lead',
        category: 'Laptop',
        price: 24_990_000,
        discountPrice: 24_490_000,
        stock: 4,
        specsSummary: 'GPU rời, RAM 16GB',
        createdAt: new Date('2026-05-13T00:00:00.000Z'),
      },
    ];
    const sessionService = {
      getLastRecommendationLedger: jest.fn().mockResolvedValue(priorLedger),
      saveRecommendationLedger: jest.fn(),
    };
    const responseComposer = {
      composeProductAdvice: jest.fn().mockResolvedValue(null),
    };

    const result = await productAdviceNode(
      {
        roomId: 'room-more-options-empty-compose',
        userText: 'có lựa chọn khác không',
        requestedMoreOptions: true,
        parsedEntities: {
          productCategory: 'laptop',
          requestedMoreOptions: true,
        },
        intentPlan: {
          needsProductRetrieval: true,
          broadNeed: false,
          requestedMoreOptions: true,
          contextualUserText: 'laptop 25 triệu học AI',
          contextResolutionReason: 'shopping_more_options_continuation',
        },
      },
      {
        productRetriever,
        catalogAdapter,
        responseComposer: responseComposer as any,
        sessionService: sessionService as any,
      },
    );

    expectDataDrivenProductAdviceFallback(result.text);
    expect(result.text).toContain('lựa chọn khác');
    expect(result.text).toContain(result.metadata.productCards[0].name);
    expect(result.metadata).toMatchObject({
      consultationMode: 'more_options',
      priorRecommendationProductIds: ['64f100000000000000000001'],
      llmComposeStatus: 'fallback',
      llmComposeFallbackReason: 'composer_returned_empty',
    });
    expect(
      result.metadata.productCards.map((card) => card.productId),
    ).not.toContain('64f100000000000000000001');
  });

  it('does not return unrelated cards for an impossible concrete GPU constraint', async () => {
    const result = await productAdviceNode(
      {
        userText: 'laptop RTX 4090 dưới 20 triệu còn hàng',
        intentPlan: { needsProductRetrieval: true, broadNeed: false },
      },
      { productRetriever, catalogAdapter },
    );

    expect(productRetriever.search).toHaveBeenCalledWith(
      'laptop RTX 4090 dưới 20 triệu còn hàng',
      expect.objectContaining({
        hardConstraints: expect.objectContaining({
          categoryHints: ['laptop'],
          maxPrice: 20_000_000,
          inStockOnly: true,
          requiredSpecs: { gpu: 'rtx 4090' },
        }),
      }),
    );
    expect(result.metadata.productCards).toEqual([]);
    expect(result.metadata.llmComposeStatus).toBe('skipped');
    expect(result.text).not.toContain('Laptop Gaming RTX 4060');
    expect(result.text).not.toContain('Laptop Office Intel');
  });

  it('returns a monitor advice response when monitor retrieval succeeds', async () => {
    const monitorSnapshot = {
      productId: '64f200000000000000000001',
      name: 'Màn hình 2K IPS 27 inch',
      price: 6_990_000,
      stock: 5,
      slug: 'man-hinh-2k-ips-27',
      image: 'https://cdn.gearvn.test/monitor-2k.jpg',
      searchMetadata: {
        normalizedSpecs: {
          resolution: '2K QHD',
          panel: 'IPS',
          color: '99% sRGB',
        },
      },
    };
    const fullHdSnapshot = {
      productId: '64f200000000000000000002',
      name: 'Màn hình Full HD IPS 27 inch',
      price: 4_990_000,
      stock: 8,
      slug: 'man-hinh-full-hd-ips-27',
      searchMetadata: {
        normalizedSpecs: { resolution: 'Full HD 1920x1080', panel: 'IPS' },
      },
    };
    productRetriever.search.mockResolvedValueOnce({
      ...retrievalResult,
      query: {
        original: 'màn hình 2K màu tốt tầm 7 triệu',
        expanded: ['monitor', '2K', 'IPS'],
        expandedText: 'màn hình 2K màu tốt tầm 7 triệu | monitor | 2K | IPS',
        constraints: {
          categoryHints: ['monitor'],
          maxPrice: 7_000_000,
          requiredSpecs: { displayResolution: '2k' },
        },
      },
      results: [
        {
          ...retrievalResult.results[0],
          productId: monitorSnapshot.productId,
          payload: {
            ...retrievalResult.results[0].payload,
            productId: monitorSnapshot.productId,
            name: monitorSnapshot.name,
            slug: monitorSnapshot.slug,
            category: 'Màn hình',
            categoryPath: ['Màn hình'],
            price: monitorSnapshot.price,
            discountPrice: monitorSnapshot.price,
            stock: monitorSnapshot.stock,
            normalizedSpecs: monitorSnapshot.searchMetadata.normalizedSpecs,
          },
        },
        {
          ...retrievalResult.results[1],
          productId: fullHdSnapshot.productId,
          payload: {
            ...retrievalResult.results[1].payload,
            productId: fullHdSnapshot.productId,
            name: fullHdSnapshot.name,
            slug: fullHdSnapshot.slug,
            category: 'Màn hình',
            categoryPath: ['Màn hình'],
            price: fullHdSnapshot.price,
            discountPrice: fullHdSnapshot.price,
            stock: fullHdSnapshot.stock,
            normalizedSpecs: fullHdSnapshot.searchMetadata.normalizedSpecs,
          },
        },
      ],
    });
    catalogAdapter.getSnapshotsByIds.mockResolvedValueOnce([
      monitorSnapshot,
      fullHdSnapshot,
    ]);

    const result = await productAdviceNode(
      {
        userText: 'màn hình 2K màu tốt tầm 7 triệu',
        intentPlan: { needsProductRetrieval: true, broadNeed: false },
      },
      { productRetriever, catalogAdapter },
    );

    expect(result.text).toContain('thẻ sản phẩm bên dưới');
    expect(result.metadata.productCards).toHaveLength(1);
    expect(result.metadata.productCards[0]).toMatchObject({
      name: 'Màn hình 2K IPS 27 inch',
      stock: 5,
    });
    expect(result.metadata.llmComposeStatus).toBe('fallback');
  });

  it('Phase 10 preserves rewrite trace metadata on normal product-card advice', async () => {
    productRetriever.search.mockResolvedValueOnce({
      ...retrievalResult,
      pipelineVersion: 'phase-10-improved',
      effectiveQuery: 'laptop gaming RTX 4060 25 triệu',
      rewrite: {
        rewrittenQuery: 'laptop gaming RTX 4060 25 triệu',
        detectedIntents: ['GAMING'],
        productGroups: ['laptop'],
        hardConstraints: { categoryHints: ['laptop'], maxPrice: 25_000_000 },
        softSignals: ['gaming'],
        expandedKeywords: ['RTX 4060'],
        comboGroups: [],
        confidence: 0.86,
        metadata: {
          rewrite_provider: 'deepseek',
          rewrite_model: 'deepseek-v4-pro',
          rewrite_status: 'success',
          rewrite_retry_count: 1,
          rewrite_latency_ms: 135,
          rewritten_query: 'laptop gaming RTX 4060 25 triệu',
        },
      },
    });

    const result = await productAdviceNode(
      {
        userText: 'Can tu van laptop gaming tam 25 trieu',
        intentPlan: { needsProductRetrieval: true, broadNeed: false },
      },
      { productRetriever, catalogAdapter },
    );

    expect(result.metadata.productCards).toHaveLength(3);
    expect(result.metadata).toMatchObject({
      rewrite_provider: 'deepseek',
      rewrite_model: 'deepseek-v4-pro',
      rewrite_status: 'success',
      rewrite_retry_count: 1,
      rewrite_latency_ms: 135,
      rewritten_query: 'laptop gaming RTX 4060 25 triệu',
    });
  });

  it('Phase 10 asks concise clarification for máy mạnh giá tốt without product cards', async () => {
    productRetriever.search.mockResolvedValueOnce({
      ...retrievalResult,
      pipelineVersion: 'phase-10-improved',
      results: [],
      clarification: {
        needed: true,
        reason: 'missing category and budget',
      },
      rewrite: {
        rewrittenQuery: 'máy mạnh giá tốt',
        detectedIntents: ['VALUE_PERFORMANCE'],
        productGroups: [],
        hardConstraints: {},
        softSignals: ['value_performance'],
        expandedKeywords: ['hiệu năng giá tốt'],
        comboGroups: [],
        confidence: 0.61,
        metadata: {
          rewrite_provider: 'deepseek',
          rewrite_model: 'deepseek-v4-pro',
          rewrite_status: 'success',
          rewrite_retry_count: 0,
          rewrite_latency_ms: 120,
          rewritten_query: 'máy mạnh giá tốt',
        },
      },
    });

    const result = await productAdviceNode(
      {
        userText: 'máy mạnh giá tốt',
        intentPlan: { needsProductRetrieval: true, broadNeed: false },
      },
      { productRetriever, catalogAdapter },
    );

    expect(result.text).toContain('Bạn ưu tiên laptop, PC hay phụ kiện?');
    expect(result.text).toContain('Ngân sách khoảng bao nhiêu?');
    expect(result.metadata.needsClarification).toBe(true);
    expect(result.metadata.followUpQuestions).toEqual([
      'Bạn ưu tiên laptop, PC hay phụ kiện?',
      'Ngân sách khoảng bao nhiêu?',
    ]);
    expect(result.metadata.productCards).toEqual([]);
    expect(result.metadata).toMatchObject({
      rewrite_provider: 'deepseek',
      rewrite_model: 'deepseek-v4-pro',
      rewrite_status: 'success',
      rewrite_retry_count: 0,
      rewrite_latency_ms: 120,
      rewritten_query: 'máy mạnh giá tốt',
    });
    expect(catalogAdapter.getSnapshotsByIds).not.toHaveBeenCalled();
  });

  it('Phase 10 preserves rewrite trace metadata on empty-result advice', async () => {
    catalogAdapter.getSnapshotsByIds.mockResolvedValueOnce([]);
    productRetriever.search.mockResolvedValueOnce({
      ...retrievalResult,
      pipelineVersion: 'phase-10-improved',
      effectiveQuery: 'laptop AI dưới 10 triệu',
      results: [],
      rewrite: {
        rewrittenQuery: 'laptop AI dưới 10 triệu',
        detectedIntents: ['STUDY'],
        productGroups: ['laptop'],
        hardConstraints: { categoryHints: ['laptop'], maxPrice: 10_000_000 },
        softSignals: ['ai_study'],
        expandedKeywords: ['AI'],
        comboGroups: [],
        confidence: 0.74,
        metadata: {
          rewrite_provider: 'deepseek',
          rewrite_model: 'deepseek-v4-pro',
          rewrite_status: 'success',
          rewrite_retry_count: 0,
          rewrite_latency_ms: 98,
          rewritten_query: 'laptop AI dưới 10 triệu',
        },
      },
    });

    const result = await productAdviceNode(
      {
        userText: 'laptop học AI dưới 10 triệu',
        intentPlan: { needsProductRetrieval: true, broadNeed: false },
      },
      { productRetriever, catalogAdapter },
    );

    expect(result.metadata.productCards).toEqual([]);
    expect(result.metadata).toMatchObject({
      rewrite_provider: 'deepseek',
      rewrite_model: 'deepseek-v4-pro',
      rewrite_status: 'success',
      rewrite_retry_count: 0,
      rewrite_latency_ms: 98,
      rewritten_query: 'laptop AI dưới 10 triệu',
    });
  });

  it('Phase 10 renders setup làm việc tại nhà as grouped product cards', async () => {
    productRetriever.search.mockResolvedValueOnce({
      ...retrievalResult,
      pipelineVersion: 'phase-10-improved',
      results: retrievalResult.results.slice(0, 6),
      comboGroups: [
        {
          id: 'laptop',
          label: 'Laptop làm việc',
          query: 'setup làm việc tại nhà laptop',
          results: retrievalResult.results.slice(0, 4),
        },
        {
          id: 'monitor',
          label: 'Màn hình rời',
          query: 'setup làm việc tại nhà màn hình',
          results: retrievalResult.results.slice(4, 7),
        },
      ],
      groupCoverage: {
        expectedGroups: ['laptop', 'monitor'],
        coveredGroups: ['laptop', 'monitor'],
        missingGroups: [],
        coverageRate: 1,
      },
    });

    const result = await productAdviceNode(
      {
        userText: 'setup làm việc tại nhà',
        intentPlan: { needsProductRetrieval: true, broadNeed: false },
      },
      { productRetriever, catalogAdapter },
    );
    expect(productRetriever.search).toHaveBeenCalledWith(
      'setup làm việc tại nhà',
      expect.objectContaining({
        rewriteContext: expect.objectContaining({
          allowDeterministicShortCircuit: false,
        }),
      }),
    );
    expect(result.metadata.productGroups).toEqual([
      expect.objectContaining({
        groupId: 'laptop',
        label: 'Laptop làm việc',
        productCards: expect.any(Array),
      }),
      expect.objectContaining({
        groupId: 'monitor',
        label: 'Màn hình rời',
        productCards: expect.any(Array),
      }),
    ]);
    for (const group of result.metadata.productGroups ?? []) {
      expect(group.productCards.length).toBeLessThanOrEqual(3);
      expect(group.productCards.length).toBeGreaterThanOrEqual(1);
    }
    expect(result.metadata.productCards).toHaveLength(
      result.metadata.productGroups!.reduce(
        (sum, group) => sum + group.productCards.length,
        0,
      ),
    );
    expect(result.metadata.group_coverage).toMatchObject({ coverageRate: 1 });
    expect(result.metadata.combo_group_count).toBe(2);
    expect(result.text).not.toBe(
      'Mình đã gửi các lựa chọn khớp nhất vào thẻ sản phẩm bên dưới để bạn xem nhanh.',
    );
    expect(result.text).toContain('gom các lựa chọn');
    expect(result.metadata.llmComposed).toBe(false);
    expect(result.metadata.llmComposeStatus).toBe('fallback');
  });

  it('Phase 10 dedupes product cards across combo groups before metadata output', async () => {
    productRetriever.search.mockResolvedValueOnce({
      ...retrievalResult,
      pipelineVersion: 'phase-10-improved',
      results: retrievalResult.results.slice(0, 3),
      comboGroups: [
        {
          id: 'laptop',
          label: 'Laptop',
          query: 'setup laptop',
          results: retrievalResult.results.slice(0, 2),
        },
        {
          id: 'storage',
          label: 'Storage',
          query: 'setup storage',
          results: [retrievalResult.results[0], retrievalResult.results[2]],
        },
      ],
      groupCoverage: {
        expectedGroups: ['laptop', 'storage'],
        coveredGroups: ['laptop', 'storage'],
        missingGroups: [],
        coverageRate: 1,
      },
    });

    const result = await productAdviceNode(
      {
        userText: 'setup học Machine Learning',
        intentPlan: { needsProductRetrieval: true, broadNeed: false },
      },
      { productRetriever, catalogAdapter },
    );

    const productIds = result.metadata.productCards.map(
      (card) => card.productId,
    );
    expect(productIds).toEqual([...new Set(productIds)]);
    expect(result.metadata.tool_results?.search_products.productIds).toEqual(
      productIds,
    );
    expect(result.metadata.tool_results?.get_product_snapshot.count).toBe(
      productIds.length,
    );
    expect(
      result.metadata.productGroups
        ?.flatMap((group) => group.productCards)
        .map((card) => card.productId),
    ).toEqual(productIds);
  });
  it('Phase 10 renders góc livestream combo groups without more than three cards per group', async () => {
    productRetriever.search.mockResolvedValueOnce({
      ...retrievalResult,
      pipelineVersion: 'phase-10-improved',
      results: retrievalResult.results.slice(0, 6),
      comboGroups: [
        {
          id: 'webcam',
          label: 'Webcam',
          query: 'góc livestream webcam',
          results: retrievalResult.results.slice(0, 5),
        },
        {
          id: 'microphone',
          label: 'Micro thu âm',
          query: 'góc livestream microphone',
          results: retrievalResult.results.slice(5, 7),
        },
      ],
      groupCoverage: {
        expectedGroups: ['webcam', 'microphone'],
        coveredGroups: ['webcam', 'microphone'],
        missingGroups: [],
        coverageRate: 1,
      },
    });

    const result = await productAdviceNode(
      {
        userText: 'góc livestream webcam micro',
        intentPlan: { needsProductRetrieval: true, broadNeed: false },
      },
      { productRetriever, catalogAdapter },
    );

    expect(result.metadata.productGroups?.map((group) => group.label)).toEqual([
      'Webcam',
      'Micro thu âm',
    ]);
    expect(
      result.metadata.productGroups?.every(
        (group) => group.productCards.length <= 3,
      ),
    ).toBe(true);
    expect(result.metadata.productCards.length).toBeGreaterThan(0);
    expectDataDrivenProductAdviceFallback(result.text);
    expect(result.metadata.llmComposed).toBe(false);
    expect(result.metadata.llmComposeStatus).toBe('fallback');
  });

  it('fast-clarifies broad livestream setup before heavy retrieval or advice composition', async () => {
    const responseComposer = {
      composeProductAdvice: jest.fn(),
      composeProductClarification: jest.fn(),
    };

    const result = await productAdviceNode(
      {
        userText: 'mình cần tư vấn setup góc làm việc cho livestream',
        intentPlan: { needsProductRetrieval: true, broadNeed: false },
      },
      {
        productRetriever,
        catalogAdapter,
        responseComposer: responseComposer as any,
      },
    );

    expect(productRetriever.search).not.toHaveBeenCalled();
    expect(catalogAdapter.getSnapshotsByIds).not.toHaveBeenCalled();
    expect(responseComposer.composeProductAdvice).not.toHaveBeenCalled();
    expect(responseComposer.composeProductClarification).not.toHaveBeenCalled();
    expect(result.metadata.needsClarification).toBe(true);
    expect(result.metadata.followUpQuestions).toEqual([
      'Bạn muốn dùng PC để bàn hay laptop?',
      'Ngân sách tổng cho góc setup khoảng bao nhiêu?',
      'Bạn cần gồm những món nào: bàn, ghế, micro, camera, đèn hay màn hình?',
    ]);
    expect(result.metadata.llmComposeFallbackReason).toBe(
      'setup_fast_clarification',
    );
  });

  it('clarifies PC correction in setup context without laptop battery questions or cards', async () => {
    const result = await productAdviceNode(
      {
        userText: 'mình cần pc cơ',
        intentPlan: {
          needsProductRetrieval: true,
          broadNeed: false,
          contextualUserText:
            'mình cần tư vấn setup góc làm việc cho livestream mình cần pc cơ',
        },
      },
      { productRetriever, catalogAdapter },
    );

    expect(productRetriever.search).not.toHaveBeenCalled();
    expect(result.metadata.productCards).toEqual([]);
    expect(result.metadata.followUpQuestions).toEqual([
      'Bạn muốn mua PC bộ lắp sẵn hay build theo linh kiện?',
      'Ngân sách cho riêng PC khoảng bao nhiêu?',
    ]);
    expect(result.text).not.toMatch(/pin|mỏng nhẹ|mong nhe/i);
  });

  it('keeps desk and chair cards when assembled desktop slot has a catalog gap', async () => {
    const deskSnapshot = {
      productId: 'desk-live-001',
      name: 'Bàn gaming livestream 120cm',
      price: 2_490_000,
      discountPrice: 2_190_000,
      stock: 5,
      slug: 'ban-gaming-livestream-120cm',
      category: 'Bàn ghế gaming',
      searchMetadata: { categoryPath: ['Bàn ghế gaming', 'Bàn gaming'] },
    };
    const chairSnapshot = {
      productId: 'chair-live-001',
      name: 'Ghế gaming công thái học',
      price: 3_490_000,
      discountPrice: 2_990_000,
      stock: 7,
      slug: 'ghe-gaming-cong-thai-hoc',
      category: 'Bàn ghế gaming',
      searchMetadata: { categoryPath: ['Bàn ghế gaming', 'Ghế gaming'] },
    };
    const toCandidate = (snapshot: typeof deskSnapshot) => ({
      ...retrievalResult.results[0],
      productId: snapshot.productId,
      payload: {
        ...retrievalResult.results[0].payload,
        productId: snapshot.productId,
        name: snapshot.name,
        slug: snapshot.slug,
        category: snapshot.category,
        categoryPath: snapshot.searchMetadata.categoryPath,
        price: snapshot.price,
        discountPrice: snapshot.discountPrice,
        stock: snapshot.stock,
      },
    });
    productRetriever.search.mockResolvedValueOnce({
      ...retrievalResult,
      query: { ...retrievalResult.query, constraints: {} },
      results: [],
      comboGroups: [
        {
          id: 'desktop_pc',
          label: 'Desktop PC',
          query: 'combo pc bàn ghế livestream desktop_pc',
          results: [],
        },
        {
          id: 'desk',
          label: 'Desk',
          query: 'combo pc bàn ghế livestream desk',
          results: [toCandidate(deskSnapshot)],
        },
        {
          id: 'chair',
          label: 'Chair',
          query: 'combo pc bàn ghế livestream chair',
          results: [toCandidate(chairSnapshot)],
        },
      ],
      groupCoverage: {
        expectedGroups: ['desktop_pc', 'desk', 'chair'],
        coveredGroups: ['desk', 'chair'],
        missingGroups: ['desktop_pc'],
        coverageRate: 2 / 3,
      },
      rewrite: {
        rewrittenQuery: 'combo pc bàn ghế livestream',
        detectedIntents: ['LIVE_STREAMING'],
        productGroups: ['pc', 'desk', 'chair'],
        hardConstraints: {},
        softSignals: ['livestream'],
        expandedKeywords: [],
        comboGroups: ['desktop_pc', 'desk', 'chair'],
        confidence: 0.8,
        metadata: {
          rewrite_provider: 'deepseek',
          rewrite_model: 'deepseek-v4-pro',
          rewrite_status: 'fallback_timeout',
          rewrite_retry_count: 0,
          rewrite_latency_ms: 12_000,
          rewritten_query: 'combo pc bàn ghế livestream',
        },
      },
    });
    catalogAdapter.getSnapshotsByIds.mockResolvedValueOnce([
      deskSnapshot,
      chairSnapshot,
    ]);

    const result = await productAdviceNode(
      {
        userText: 'combo pc bàn ghế livestream',
        intentPlan: { needsProductRetrieval: true, broadNeed: false },
      },
      { productRetriever, catalogAdapter },
    );

    expect(result.metadata.productCards.map((card) => card.name)).toEqual([
      'Bàn gaming livestream 120cm',
      'Ghế gaming công thái học',
    ]);
    expect(result.metadata.setup_slot_coverage).toEqual({
      requestedSlots: ['desktop_pc', 'desk', 'chair'],
      coveredSlots: ['desk', 'chair'],
      missingSlots: ['desktop_pc'],
    });
    expect(result.metadata.group_coverage).toMatchObject({
      coveredGroups: ['desk', 'chair'],
      missingGroups: ['desktop_pc'],
    });
    expect(result.text).toMatch(
      /catalog chưa có lựa chọn phù hợp cho PC bộ\/desktop PC/i,
    );
    expect(result.text).toMatch(/không thay PC bộ bằng linh kiện rời/i);
    expect(
      result.metadata.productCards.map((card) => card.name).join(' '),
    ).not.toMatch(/CPU|iPhone|điện thoại/i);
  });

  it('uses bounded desk/chair-only setup follow-up path without combo rewrite or composer', async () => {
    const deskSnapshot = {
      productId: 'desk-follow-001',
      name: 'Bàn làm việc livestream 140cm',
      price: 2_990_000,
      discountPrice: 2_490_000,
      stock: 4,
      slug: 'ban-lam-viec-livestream-140cm',
      category: 'Bàn ghế gaming',
      searchMetadata: { categoryPath: ['Bàn ghế gaming', 'Bàn gaming'] },
    };
    const chairSnapshot = {
      productId: 'chair-follow-001',
      name: 'Ghế công thái học livestream',
      price: 3_990_000,
      discountPrice: 3_490_000,
      stock: 6,
      slug: 'ghe-cong-thai-hoc-livestream',
      category: 'Bàn ghế gaming',
      searchMetadata: { categoryPath: ['Bàn ghế gaming', 'Ghế gaming'] },
    };
    const toCandidate = (snapshot: typeof deskSnapshot) => ({
      ...retrievalResult.results[0],
      productId: snapshot.productId,
      payload: {
        ...retrievalResult.results[0].payload,
        productId: snapshot.productId,
        name: snapshot.name,
        slug: snapshot.slug,
        category: snapshot.category,
        categoryPath: snapshot.searchMetadata.categoryPath,
        price: snapshot.price,
        discountPrice: snapshot.discountPrice,
        stock: snapshot.stock,
      },
    });
    productRetriever.search
      .mockResolvedValueOnce({
        ...retrievalResult,
        results: [toCandidate(deskSnapshot)],
      })
      .mockResolvedValueOnce({
        ...retrievalResult,
        results: [toCandidate(chairSnapshot)],
      });
    catalogAdapter.getSnapshotsByIds.mockResolvedValueOnce([
      deskSnapshot,
      chairSnapshot,
    ]);
    const responseComposer = {
      composeProductAdvice: jest.fn(),
      composeProductClarification: jest.fn(),
    };

    const result = await productAdviceNode(
      {
        userText: 'thế còn bàn ghế thì sao',
        intentPlan: {
          needsProductRetrieval: true,
          broadNeed: false,
          contextualUserText:
            'combo pc, bàn, ghế phục vụ cho livestream thế còn bàn ghế thì sao',
          contextResolutionReason: 'shopping_setup_continuation',
        },
      },
      {
        productRetriever,
        catalogAdapter,
        responseComposer: responseComposer as any,
      },
    );

    expect(productRetriever.search).toHaveBeenCalledTimes(2);
    expect(productRetriever.search).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('ban lam viec'),
      expect.objectContaining({
        pipeline: 'phase-09.2-baseline',
        hardConstraints: { categoryHints: ['desk'], inStockOnly: true },
      }),
    );
    expect(productRetriever.search).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('ghe cong thai hoc'),
      expect.objectContaining({
        pipeline: 'phase-09.2-baseline',
        hardConstraints: { categoryHints: ['chair'], inStockOnly: true },
      }),
    );
    expect(responseComposer.composeProductAdvice).not.toHaveBeenCalled();
    expect(responseComposer.composeProductClarification).not.toHaveBeenCalled();
    expect(result.metadata.productCards.map((card) => card.name)).toEqual([
      'Bàn làm việc livestream 140cm',
      'Ghế công thái học livestream',
    ]);
    expect(result.metadata.setup_slot_coverage).toEqual({
      requestedSlots: ['desk', 'chair'],
      coveredSlots: ['desk', 'chair'],
      missingSlots: [],
    });
    expect(result.metadata.group_coverage).toMatchObject({
      coveredGroups: ['desk', 'chair'],
      missingGroups: [],
    });
    expect(result.metadata).toMatchObject({
      rewrite_status: 'skipped',
      rewrite_model: 'not_called',
      rewrite_skipped_reason: 'setup_slot_followup_fast_path',
      llmComposeStatus: 'skipped',
      llmComposeFallbackReason: 'setup_slot_followup_fast_path',
    });
  });

  it('returns a clear desk/chair gap from the fast setup follow-up path', async () => {
    productRetriever.search.mockResolvedValue({
      ...retrievalResult,
      results: [],
    });
    const responseComposer = {
      composeProductAdvice: jest.fn(),
      composeProductClarification: jest.fn(),
    };

    const result = await productAdviceNode(
      {
        userText: 'bàn ghế thì sao',
        intentPlan: {
          needsProductRetrieval: true,
          broadNeed: false,
          contextualUserText:
            'setup góc làm việc cho livestream combo pc bàn ghế bàn ghế thì sao',
          contextResolutionReason: 'shopping_setup_continuation',
        },
      },
      {
        productRetriever,
        catalogAdapter,
        responseComposer: responseComposer as any,
      },
    );

    expect(productRetriever.search).toHaveBeenCalledTimes(2);
    expect(catalogAdapter.getSnapshotsByIds).not.toHaveBeenCalled();
    expect(responseComposer.composeProductAdvice).not.toHaveBeenCalled();
    expect(result.metadata.productCards).toHaveLength(0);
    expect(result.metadata.setup_slot_coverage).toEqual({
      requestedSlots: ['desk', 'chair'],
      coveredSlots: [],
      missingSlots: ['desk', 'chair'],
    });
    expect(result.text).toMatch(/catalog chưa có lựa chọn phù hợp cho bàn, ghế/i);
    expect(result.metadata.llmComposeFallbackReason).toBe(
      'setup_slot_followup_fast_path',
    );
  });
  it('computes slot coverage from displayed cards after filtering', async () => {
    const desktopSnapshot = {
      productId: 'desktop-oos-001',
      name: 'PC GVN livestream RTX 4060',
      price: 24_990_000,
      discountPrice: 23_990_000,
      stock: 0,
      slug: 'pc-gvn-livestream-rtx-4060',
      category: 'PC GVN',
      searchMetadata: { categoryPath: ['PC GVN'] },
    };
    const monitorSnapshot = {
      productId: 'monitor-live-001',
      name: 'Màn hình livestream 27 inch',
      price: 4_990_000,
      discountPrice: 4_690_000,
      stock: 4,
      slug: 'man-hinh-livestream-27',
      category: 'Màn hình',
      searchMetadata: { categoryPath: ['Màn hình'] },
    };
    const toCandidate = (snapshot: typeof desktopSnapshot) => ({
      ...retrievalResult.results[0],
      productId: snapshot.productId,
      payload: {
        ...retrievalResult.results[0].payload,
        productId: snapshot.productId,
        name: snapshot.name,
        slug: snapshot.slug,
        category: snapshot.category,
        categoryPath: snapshot.searchMetadata.categoryPath,
        price: snapshot.price,
        discountPrice: snapshot.discountPrice,
        stock: snapshot.stock,
      },
    });
    productRetriever.search.mockResolvedValueOnce({
      ...retrievalResult,
      query: { ...retrievalResult.query, constraints: {} },
      results: [],
      comboGroups: [
        {
          id: 'desktop_pc',
          label: 'Desktop PC',
          query: 'setup desktop_pc',
          results: [toCandidate(desktopSnapshot)],
        },
        {
          id: 'monitor',
          label: 'Monitor',
          query: 'setup monitor',
          results: [toCandidate(monitorSnapshot)],
        },
      ],
      groupCoverage: {
        expectedGroups: ['desktop_pc', 'monitor'],
        coveredGroups: ['desktop_pc', 'monitor'],
        missingGroups: [],
        coverageRate: 1,
      },
    });
    catalogAdapter.getSnapshotsByIds.mockResolvedValueOnce([
      desktopSnapshot,
      monitorSnapshot,
    ]);

    const result = await productAdviceNode(
      {
        userText: 'combo pc màn hình livestream',
        intentPlan: { needsProductRetrieval: true, broadNeed: false },
      },
      { productRetriever, catalogAdapter },
    );

    expect(result.metadata.productCards.map((card) => card.productId)).toEqual([
      'monitor-live-001',
    ]);
    expect(result.metadata.setup_slot_coverage).toEqual({
      requestedSlots: ['desktop_pc', 'monitor'],
      coveredSlots: ['monitor'],
      missingSlots: ['desktop_pc'],
    });
    expect(result.metadata.group_coverage).toMatchObject({
      coveredGroups: ['monitor'],
      missingGroups: ['desktop_pc'],
      coverageRate: 0.5,
    });
  });
  it('does not display optional combo groups when explicit PC desk chair slots are missing', async () => {
    const monitorSnapshot = {
      productId: 'monitor-generic-001',
      name: 'Màn hình livestream 27 inch',
      price: 4_990_000,
      discountPrice: 4_690_000,
      stock: 4,
      slug: 'man-hinh-livestream-27',
      category: 'Màn hình',
      searchMetadata: { categoryPath: ['Màn hình'] },
    };
    const keyboardSnapshot = {
      productId: 'keyboard-generic-001',
      name: 'Bàn phím cơ cho creator',
      price: 1_990_000,
      discountPrice: 1_690_000,
      stock: 6,
      slug: 'ban-phim-co-creator',
      category: 'Bàn phím',
      searchMetadata: { categoryPath: ['Bàn phím'] },
    };
    const toCandidate = (snapshot: typeof monitorSnapshot) => ({
      ...retrievalResult.results[0],
      productId: snapshot.productId,
      payload: {
        ...retrievalResult.results[0].payload,
        productId: snapshot.productId,
        name: snapshot.name,
        slug: snapshot.slug,
        category: snapshot.category,
        categoryPath: snapshot.searchMetadata.categoryPath,
        price: snapshot.price,
        discountPrice: snapshot.discountPrice,
        stock: snapshot.stock,
      },
    });
    productRetriever.search.mockResolvedValueOnce({
      ...retrievalResult,
      query: { ...retrievalResult.query, constraints: {} },
      results: [],
      comboGroups: [
        {
          id: 'desktop_pc',
          label: 'Desktop PC',
          query: 'setup desktop_pc',
          results: [],
        },
        {
          id: 'desk',
          label: 'Desk',
          query: 'setup desk',
          results: [],
        },
        {
          id: 'chair',
          label: 'Chair',
          query: 'setup chair',
          results: [],
        },
        {
          id: 'monitor',
          label: 'Monitor',
          query: 'setup monitor',
          results: [toCandidate(monitorSnapshot)],
        },
        {
          id: 'keyboard',
          label: 'Keyboard',
          query: 'setup keyboard',
          results: [toCandidate(keyboardSnapshot)],
        },
      ],
      groupCoverage: {
        expectedGroups: ['desktop_pc', 'desk', 'chair', 'monitor', 'keyboard'],
        coveredGroups: ['monitor', 'keyboard'],
        missingGroups: ['desktop_pc', 'desk', 'chair'],
        coverageRate: 0.4,
      },
      rewrite: {
        rewrittenQuery: 'combo pc bàn ghế livestream',
        detectedIntents: ['LIVE_STREAMING'],
        productGroups: ['pc', 'desk', 'chair'],
        hardConstraints: {},
        softSignals: ['livestream'],
        expandedKeywords: [],
        comboGroups: ['desktop_pc', 'desk', 'chair', 'monitor', 'keyboard'],
        confidence: 0.8,
        metadata: {
          rewrite_provider: 'deepseek',
          rewrite_model: 'deepseek-v4-pro',
          rewrite_status: 'fallback_timeout',
          rewrite_retry_count: 0,
          rewrite_latency_ms: 12_000,
          rewritten_query: 'combo pc bàn ghế livestream',
        },
      },
    });
    catalogAdapter.getSnapshotsByIds.mockResolvedValueOnce([
      monitorSnapshot,
      keyboardSnapshot,
    ]);

    const result = await productAdviceNode(
      {
        userText: 'combo pc bàn ghế livestream',
        intentPlan: { needsProductRetrieval: true, broadNeed: false },
      },
      { productRetriever, catalogAdapter },
    );

    expect(result.metadata.productCards).toEqual([]);
    expect(result.metadata.productGroups).toEqual([]);
    expect(result.metadata.setup_slot_coverage).toEqual({
      requestedSlots: ['desktop_pc', 'desk', 'chair', 'monitor', 'keyboard'],
      coveredSlots: [],
      missingSlots: ['desktop_pc', 'desk', 'chair', 'monitor', 'keyboard'],
    });
    expect(result.metadata.group_coverage).toMatchObject({
      coveredGroups: [],
      missingGroups: ['desktop_pc', 'desk', 'chair', 'monitor', 'keyboard'],
    });
    expect(result.metadata.tool_results?.search_products.productIds).toEqual(
      [],
    );
    expect(result.text).not.toMatch(/Màn hình|Bàn phím/i);
  });
  it('CHAT-02 D-13 asks follow-up questions before retrieval for broad needs', async () => {
    const responseComposer = {
      composeProductClarification: jest
        .fn()
        .mockResolvedValue(
          'Bạn cho mình biết ngân sách, mục đích học/làm việc và kích thước màn hình mong muốn nhé?',
        ),
    };
    const result = await productAdviceNode(
      {
        userText: 'Can mua laptop',
        intentPlan: { needsProductRetrieval: true, broadNeed: true },
      },
      {
        productRetriever,
        catalogAdapter,
        responseComposer: responseComposer as any,
      },
    );

    expect(productRetriever.search).not.toHaveBeenCalled();
    expect(catalogAdapter.getSnapshotsByIds).not.toHaveBeenCalled();
    expect(result.text).toContain('ngân sách');
    expect(responseComposer.composeProductClarification).toHaveBeenCalledWith(
      expect.objectContaining({
        userText: 'Can mua laptop',
        followUpQuestions: expect.arrayContaining([
          expect.stringMatching(/ngân sách|nhu cầu|màn hình|game/i),
        ]),
      }),
    );
    expect(result.metadata.productCards).toHaveLength(0);
    expect(result.metadata.followUpQuestions).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/ngân sách|nhu cầu|màn hình|game/i),
      ]),
    );
    expect(result.metadata.needsClarification).toBe(true);
    expect(result.metadata.llmComposed).toBe(true);
  });

  it('falls back to minimal broad-need clarification when composer is unavailable', async () => {
    const result = await productAdviceNode(
      {
        userText: 'Can mua laptop',
        intentPlan: { needsProductRetrieval: true, broadNeed: true },
      },
      { productRetriever, catalogAdapter },
    );

    expect(productRetriever.search).not.toHaveBeenCalled();
    expect(result.text).toMatch(/ngân sách|nhu cầu|màn hình/i);
    expect(result.metadata.needsClarification).toBe(true);
    expect(result.metadata.llmComposed).toBe(false);
  });

  it('infers broad laptop advice defensively when supervisor omits broadNeed', async () => {
    const result = await productAdviceNode(
      {
        userText: 'mình cần tư vấn laptop',
        intentPlan: { needsProductRetrieval: true },
      },
      { productRetriever, catalogAdapter },
    );

    expect(productRetriever.search).not.toHaveBeenCalled();
    expect(catalogAdapter.getSnapshotsByIds).not.toHaveBeenCalled();
    expect(result.metadata.needsClarification).toBe(true);
    expect(result.metadata.productCards).toHaveLength(0);
  });

  it('treats slangy generic laptop advice as broad and asks clarification', async () => {
    const result = await productAdviceNode(
      {
        userText: 'tư vấn laptop cho tao đê',
        intentPlan: { needsProductRetrieval: true },
      },
      { productRetriever, catalogAdapter },
    );

    expect(productRetriever.search).not.toHaveBeenCalled();
    expect(result.metadata.needsClarification).toBe(true);
    expect(result.metadata.productCards).toHaveLength(0);
  });

  it.each(['tư vấn laptop phổ thông', 'tu van laptop co ban'])(
    'treats generic descriptor advice as broad and asks clarification: %s',
    async (userText) => {
      const result = await productAdviceNode(
        {
          userText,
          intentPlan: { needsProductRetrieval: true },
        },
        { productRetriever, catalogAdapter },
      );

      expect(productRetriever.search).not.toHaveBeenCalled();
      expect(catalogAdapter.getSnapshotsByIds).not.toHaveBeenCalled();
      expect(result.metadata.needsClarification).toBe(true);
      expect(result.metadata.productCards).toHaveLength(0);
    },
  );
  it('normalizes common laptop typos before searching catalog', async () => {
    await productAdviceNode(
      {
        userText: 'có laptp nào dưới 25 triệu ko bạn',
        intentPlan: { needsProductRetrieval: true, broadNeed: false },
      },
      { productRetriever, catalogAdapter },
    );

    expect(productRetriever.search).toHaveBeenCalledWith(
      'có laptop nào dưới 25 triệu ko bạn',
      expect.objectContaining({ topK: 3 }),
    );
  });

  it('uses fast catalog search for simple availability and budget queries', async () => {
    const fastCatalogAdapter = {
      getSnapshotsByIds: jest.fn().mockResolvedValue(catalogSnapshots),
      searchProducts: jest.fn().mockResolvedValue(retrievalResult),
      searchProductsFast: jest.fn().mockResolvedValue(retrievalResult),
    } as unknown as jest.Mocked<ProductCatalogAdapter>;
    const responseComposer = {
      composeProductAdvice: jest.fn().mockResolvedValue('LLM text'),
    };

    const result = await productAdviceNode(
      {
        userText: 'có laptp nào dưới 25 triệu ko bạn',
        intentPlan: { needsProductRetrieval: true, broadNeed: false },
      },
      {
        productRetriever,
        catalogAdapter: fastCatalogAdapter,
        responseComposer: responseComposer as any,
      },
    );

    expect(fastCatalogAdapter.searchProductsFast).toHaveBeenCalledWith(
      'có laptop nào dưới 25 triệu ko bạn',
      expect.objectContaining({ topK: 3 }),
    );
    expect(fastCatalogAdapter.searchProducts).not.toHaveBeenCalled();
    expect(productRetriever.search).not.toHaveBeenCalled();
    expect(responseComposer.composeProductAdvice).toHaveBeenCalledWith(
      expect.objectContaining({
        userText: 'có laptop nào dưới 25 triệu ko bạn',
        productCards: expect.arrayContaining([
          expect.objectContaining({ name: 'Laptop Gaming RTX 4060' }),
        ]),
      }),
    );
    expect(result.metadata).toMatchObject({
      rewrite_status: 'skipped',
      rewrite_model: 'not_called',
      rewrite_latency_ms: 0,
      rewrite_skipped_reason: 'fast_catalog_exact_lookup',
    });
  });

  it.each([
    'có laptop nào dưới 25 triệu để học đồ họa không',
    'có laptop nào dưới 20 triệu xem phim/giải trí không',
    'có bộ PC nào tầm 30 triệu làm CAD/kỹ thuật không',
    'tư vấn laptop xem phim giải trí',
  ])(
    'uses improved retrieval for specific advice instead of fast catalog search: %s',
    async (userText) => {
      const fastCatalogAdapter = {
        getSnapshotsByIds: jest.fn().mockResolvedValue(catalogSnapshots),
        searchProducts: jest.fn().mockResolvedValue(retrievalResult),
        searchProductsFast: jest.fn().mockResolvedValue(retrievalResult),
      } as unknown as jest.Mocked<ProductCatalogAdapter>;

      await productAdviceNode(
        {
          userText,
          intentPlan: { needsProductRetrieval: true },
        },
        { productRetriever, catalogAdapter: fastCatalogAdapter },
      );

      expect(productRetriever.search).toHaveBeenCalledWith(
        userText,
        expect.objectContaining({
          topK: 3,
          pipeline: 'phase-10-improved',
        }),
      );
      expect(fastCatalogAdapter.searchProductsFast).not.toHaveBeenCalled();
    },
  );

  it('uses improved retrieval for AI/ML continuation turns instead of fast catalog search', async () => {
    const fastCatalogAdapter = {
      getSnapshotsByIds: jest.fn().mockResolvedValue(catalogSnapshots),
      searchProducts: jest.fn().mockResolvedValue(retrievalResult),
      searchProductsFast: jest.fn().mockResolvedValue(retrievalResult),
    } as unknown as jest.Mocked<ProductCatalogAdapter>;

    await productAdviceNode(
      {
        userText:
          'Ngân sách 25 triệu, dùng để học machine learning/AI, ưu tiên hiệu năng',
        intentPlan: {
          needsProductRetrieval: true,
          broadNeed: false,
          contextualUserText:
            'laptop Ngân sách 25 triệu, dùng để học machine learning/AI, ưu tiên hiệu năng',
        },
      },
      { productRetriever, catalogAdapter: fastCatalogAdapter },
    );

    expect(productRetriever.search).toHaveBeenCalledWith(
      'rtx gpu laptop Ngân sách 25 triệu, dùng để học machine learning/AI, ưu tiên hiệu năng',
      expect.objectContaining({
        topK: 3,
        pipeline: 'phase-10-improved',
      }),
    );
    expect(fastCatalogAdapter.searchProductsFast).not.toHaveBeenCalled();
  });

  it('passes logical PC category hints for CAD and engineering advice', async () => {
    await productAdviceNode(
      {
        userText: 'có bộ PC nào tầm 30 triệu làm CAD/kỹ thuật không',
        parsedEntities: { productCategory: 'pc' },
        intentPlan: { needsProductRetrieval: true, broadNeed: false },
      },
      { productRetriever, catalogAdapter },
    );

    expect(productRetriever.search).toHaveBeenCalledWith(
      'có bộ PC nào tầm 30 triệu làm CAD/kỹ thuật không',
      expect.objectContaining({
        hardConstraints: { categoryHints: ['pc'] },
        pipeline: 'phase-10-improved',
        rewriteContext: expect.objectContaining({
          hardConstraints: { categoryHints: ['pc'] },
        }),
      }),
    );
  });

  it('keeps original explicit PC family when contextual search text omits it', async () => {
    await productAdviceNode(
      {
        userText: 'tư vấn bộ PC tầm 30 triệu để làm CAD/kỹ thuật',
        intentPlan: {
          needsProductRetrieval: true,
          broadNeed: false,
          contextualUserText: 'tầm 30 triệu để làm CAD/kỹ thuật',
        },
      },
      { productRetriever, catalogAdapter },
    );

    expect(productRetriever.search).toHaveBeenCalledWith(
      'tầm 30 triệu để làm CAD/kỹ thuật',
      expect.objectContaining({
        hardConstraints: { categoryHints: ['pc'] },
        rewriteContext: expect.objectContaining({
          hardConstraints: { categoryHints: ['pc'] },
          originalQuery: 'tư vấn bộ PC tầm 30 triệu để làm CAD/kỹ thuật',
        }),
      }),
    );
  });

  it.each([
    ['điện thoại', 'tư vấn iPhone tầm 20 triệu', 'tầm 20 triệu', 'phone'],
    ['webcam', 'cần webcam học online', 'học online', 'webcam'],
    ['microphone', 'gợi ý micro thu âm', 'thu âm', 'microphone'],
    ['chair', 'tư vấn ghế gaming', 'gaming', 'chair'],
    ['accessory', 'cần phụ kiện GearVN', 'GearVN', 'accessory'],
    ['storage', 'gợi ý ổ cứng SSD 1TB', 'SSD 1TB', 'storage'],
  ])(
    'keeps original explicit %s family when contextual search text omits it',
    async (_label, userText, contextualUserText, expectedCategory) => {
      productRetriever.search.mockClear();

      await productAdviceNode(
        {
          userText,
          intentPlan: {
            needsProductRetrieval: true,
            broadNeed: false,
            contextualUserText,
          },
        },
        { productRetriever, catalogAdapter },
      );

      expect(productRetriever.search).toHaveBeenCalledWith(
        contextualUserText,
        expect.objectContaining({
          hardConstraints: { categoryHints: [expectedCategory] },
          rewriteContext: expect.objectContaining({
            hardConstraints: { categoryHints: [expectedCategory] },
            originalQuery: userText,
          }),
        }),
      );
    },
  );
  it('filters visible cards with explicit PC hard category even when rewrite drifts to laptop', async () => {
    const laptopSnapshot = {
      ...catalogSnapshots[0],
      category: 'Laptop',
      searchMetadata: { categoryPath: ['Laptop'] },
    };
    const pcSnapshot = {
      productId: 'pc-cad-rtx-001',
      name: 'PC GVN CAD RTX 4060',
      price: 29_990_000,
      discountPrice: 29_490_000,
      stock: 4,
      slug: 'pc-gvn-cad-rtx-4060',
      category: 'PC GVN',
      searchMetadata: {
        categoryPath: ['PC GVN', 'PC đồ họa'],
        specsSummary: 'RTX 4060, RAM 32GB, SSD 1TB',
      },
    };
    const driftedResults = [laptopSnapshot, pcSnapshot].map(
      (snapshot, index) => ({
        ...retrievalResult.results[0],
        productId: snapshot.productId,
        score: 0.9 - index * 0.05,
        rerankScore: 90 - index,
        payload: {
          ...retrievalResult.results[0].payload,
          productId: snapshot.productId,
          name: snapshot.name,
          slug: snapshot.slug,
          category: snapshot.category,
          categoryPath: snapshot.searchMetadata.categoryPath,
          price: snapshot.price,
          discountPrice:
            (snapshot as { discountPrice?: number }).discountPrice ??
            snapshot.price,
          stock: snapshot.stock,
          normalizedSpecs: snapshot.searchMetadata,
        },
      }),
    );

    productRetriever.search.mockResolvedValueOnce({
      ...retrievalResult,
      query: {
        ...retrievalResult.query,
        constraints: { categoryHints: ['laptop'], maxPrice: 35_000_000 },
      },
      results: driftedResults,
    });
    catalogAdapter.getSnapshotsByIds.mockResolvedValueOnce([
      laptopSnapshot,
      pcSnapshot,
    ]);

    const result = await productAdviceNode(
      {
        userText: 'có bộ PC nào tầm 30 triệu làm CAD/kỹ thuật không',
        parsedEntities: { productCategory: 'pc' },
        intentPlan: { needsProductRetrieval: true, broadNeed: false },
      },
      { productRetriever, catalogAdapter },
    );

    expect(productRetriever.search).toHaveBeenCalledWith(
      expect.stringContaining('bộ PC'),
      expect.objectContaining({
        hardConstraints: { categoryHints: ['pc'] },
      }),
    );
    expect(result.metadata.productCards.map((card) => card.name)).toEqual([
      'PC GVN CAD RTX 4060',
    ]);
    expectDataDrivenProductAdviceFallback(result.text);
    expect(result.text).toContain('PC GVN CAD RTX 4060');
  });

  it('does not echo rough customer pronouns in grounded product advice text', async () => {
    const result = await productAdviceNode(
      {
        userText: 'có laptop nào dưới 25 triệu cho tao học AI không',
        intentPlan: { needsProductRetrieval: true, broadNeed: false },
      },
      { productRetriever, catalogAdapter },
    );

    expect(result.text).not.toContain('tao');
    expectDataDrivenProductAdviceFallback(result.text);
  });
  it('excludes prior recommendation IDs when user asks for more options', async () => {
    const sessionService = {
      getLastRecommendationLedger: jest
        .fn()
        .mockResolvedValue([
          { productId: '64f100000000000000000001' },
          { productId: '64f100000000000000000002' },
        ]),
      saveRecommendationLedger: jest.fn(),
    };

    const result = await productAdviceNode(
      {
        roomId: 'room-more-options-exclude',
        userText: 'có máy khác nữa không',
        parsedEntities: {
          productCategory: 'laptop',
          requestedMoreOptions: true,
        },
        intentPlan: {
          needsProductRetrieval: true,
          broadNeed: false,
          requestedMoreOptions: true,
          contextualUserText: 'tư vấn laptop 25 triệu học AI',
        },
      },
      {
        productRetriever,
        catalogAdapter,
        sessionService: sessionService as any,
      },
    );

    expect(sessionService.getLastRecommendationLedger).toHaveBeenCalledWith(
      'room-more-options-exclude',
    );
    expect(productRetriever.search).toHaveBeenCalledWith(
      'rtx gpu tư vấn laptop 25 triệu học AI',
      expect.objectContaining({ topK: 7 }),
    );
    expect(
      result.metadata.productCards.map((card) => card.productId),
    ).not.toEqual(
      expect.arrayContaining([
        '64f100000000000000000001',
        '64f100000000000000000002',
      ]),
    );
    expect(result.metadata).toMatchObject({
      consultationMode: 'more_options',
      priorRecommendationProductIds: [
        '64f100000000000000000001',
        '64f100000000000000000002',
      ],
    });
  });

  it('keeps follow-up context and sorts more products by descending price', async () => {
    productRetriever.search.mockResolvedValueOnce({
      ...retrievalResult,
      query: {
        ...retrievalResult.query,
        constraints: {},
      },
    });

    const result = await productAdviceNode(
      {
        userText: 'gợi ý thêm sản phẩm, sort giá từ trên xuống dưới',
        intentPlan: {
          needsProductRetrieval: true,
          broadNeed: false,
          requestedMoreOptions: true,
          contextualUserText:
            'laptop 40 triệu, học AI/ML gợi ý thêm sản phẩm, sort giá từ trên xuống dưới',
          priceSort: 'desc',
        },
        parsedEntities: {
          productCategory: 'laptop',
          requestedMoreOptions: true,
          priceSort: 'desc',
        },
      },
      { productRetriever, catalogAdapter },
    );

    expect(productRetriever.search).toHaveBeenCalledWith(
      'rtx gpu laptop 40 triệu, học AI/ML gợi ý thêm sản phẩm',
      expect.objectContaining({ topK: 8 }),
    );
    expect(productRetriever.search.mock.calls[0][0]).not.toContain('sort');
    expect(result.metadata.price_sort).toBe('desc');
    expectDataDrivenProductAdviceFallback(result.text);
    expect(result.text).toContain('lựa chọn khác');
    expect(result.metadata.productCards.map((card) => card.name)).toEqual([
      'Laptop Creator OLED',
      'Laptop Gaming RTX 4060',
      'Laptop Gaming Entry',
      'Laptop Thin Light',
      'Laptop Business 14',
    ]);
  });

  it('sorts the previously shown product cards by price without starting a new retrieval', async () => {
    const sessionService = {
      getLastRecommendationLedger: jest.fn().mockResolvedValue([
        {
          rank: 1,
          productId: 'thinkpad-e14-gen7',
          name: 'Laptop Lenovo ThinkPad E14 Gen 7 21SX002UVN',
          slug: 'thinkpad-e14-gen7',
          category: 'Laptop',
          price: 24_990_000,
          discountPrice: 24_690_000,
          stock: 10,
          specsSummary: 'RAM 16GB, SSD 512GB',
          createdAt: new Date('2026-05-13T00:00:00.000Z'),
        },
        {
          rank: 2,
          productId: 'ideapad-slim-5-oled',
          name: 'Laptop Lenovo IdeaPad Slim 5 OLED 14AKP10 83HX001KVN',
          slug: 'ideapad-slim-5-oled-14akp10-83hx001kvn',
          category: 'Laptop',
          price: 23_090_000,
          discountPrice: 21_990_000,
          stock: 10,
          specsSummary: 'OLED, RAM 16GB',
          createdAt: new Date('2026-05-13T00:00:00.000Z'),
        },
        {
          rank: 3,
          productId: 'vivobook-16',
          name: 'Laptop ASUS Vivobook 16 A1607QA-MB067WS',
          slug: 'vivobook-16-a1607qa-mb067ws',
          category: 'Laptop',
          price: 20_990_000,
          discountPrice: 17_990_000,
          stock: 10,
          specsSummary: '16 inch, RAM 16GB',
          createdAt: new Date('2026-05-13T00:00:00.000Z'),
        },
      ]),
      saveRecommendationLedger: jest.fn(),
    };

    const result = await productAdviceNode(
      {
        roomId: 'room-sort-existing-cards',
        userText: 'sort giá mấy sản phẩm trên',
        intentPlan: {
          needsProductRetrieval: true,
          broadNeed: false,
          priceSort: 'asc',
        },
        parsedEntities: { priceSort: 'asc' },
      },
      {
        productRetriever,
        catalogAdapter,
        sessionService: sessionService as any,
      },
    );

    expect(productRetriever.search).not.toHaveBeenCalled();
    expect(catalogAdapter.getSnapshotsByIds).not.toHaveBeenCalled();
    expect(result.metadata.price_sort).toBe('asc');
    expectDataDrivenProductAdviceFallback(result.text);
    expect(result.text).toContain('sắp xếp lại');
    expect(result.metadata.productCards.map((card) => card.name)).toEqual([
      'Laptop ASUS Vivobook 16 A1607QA-MB067WS',
      'Laptop Lenovo IdeaPad Slim 5 OLED 14AKP10 83HX001KVN',
      'Laptop Lenovo ThinkPad E14 Gen 7 21SX002UVN',
    ]);
    expect(sessionService.saveRecommendationLedger).toHaveBeenCalledWith(
      'room-sort-existing-cards',
      expect.arrayContaining([
        expect.objectContaining({ productId: 'vivobook-16' }),
      ]),
    );
    expect(result.metadata).toMatchObject({
      consultationMode: 'price_sort',
      priorRecommendationProductIds: [
        'thinkpad-e14-gen7',
        'ideapad-slim-5-oled',
        'vivobook-16',
      ],
      comparedProductIds: [
        'vivobook-16',
        'ideapad-slim-5-oled',
        'thinkpad-e14-gen7',
      ],
    });
  });

  it('prepends parsed product category when contextual text lost the catalog class', async () => {
    const fastCatalogAdapter = {
      getSnapshotsByIds: jest.fn().mockResolvedValue(catalogSnapshots),
      searchProducts: jest.fn().mockResolvedValue(retrievalResult),
      searchProductsFast: jest.fn().mockResolvedValue(retrievalResult),
    } as unknown as jest.Mocked<ProductCatalogAdapter>;

    await productAdviceNode(
      {
        userText: 'mình có tối đa 25 triệu thôi, tìm cho mình',
        parsedEntities: {
          productCategory: 'laptop',
          contextualUserText:
            'tầm 25 triệu, nhu cầu học AI/Machine Learning mình có tối đa 25 triệu thôi, tìm cho mình',
        },
        intentPlan: {
          needsProductRetrieval: true,
          broadNeed: false,
          contextualUserText:
            'tầm 25 triệu, nhu cầu học AI/Machine Learning mình có tối đa 25 triệu thôi, tìm cho mình',
        },
      },
      { productRetriever, catalogAdapter: fastCatalogAdapter },
    );

    expect(productRetriever.search).toHaveBeenCalledWith(
      'rtx gpu laptop tầm 25 triệu, nhu cầu học AI/Machine Learning mình có tối đa 25 triệu thôi, tìm cho mình',
      expect.objectContaining({
        topK: 3,
        pipeline: 'phase-10-improved',
      }),
    );
    expect(fastCatalogAdapter.searchProductsFast).not.toHaveBeenCalled();
  });

  it('filters visible product cards against active budget and category constraints', async () => {
    const badSnapshots = [
      {
        ...catalogSnapshots[1],
        category: 'Laptop',
        price: 52_490_000,
        discountPrice: 52_490_000,
        searchMetadata: { categoryPath: ['Laptop'] },
      },
      {
        productId: '64f100000000000000000006',
        name: 'iPhone 15 128GB',
        price: 17_590_000,
        discountPrice: 17_590_000,
        stock: 10,
        slug: 'iphone-15-128gb',
        category: 'Điện thoại',
        searchMetadata: { categoryPath: ['Điện thoại'] },
      },
      {
        productId: '64f100000000000000000007',
        name: 'Mac mini M4 2024 10CPU 10GPU 16GB 256GB',
        price: 14_990_000,
        discountPrice: 14_990_000,
        stock: 10,
        slug: 'mac-mini-m4-2024-16gb-256gb',
        category: 'laptop',
        searchMetadata: { categoryPath: ['Laptop', 'Mac', 'Mac mini'] },
      },
      {
        ...catalogSnapshots[0],
        category: 'Laptop',
        discountPrice: catalogSnapshots[0].price,
        searchMetadata: { categoryPath: ['Laptop'] },
      },
    ];
    const badResults = badSnapshots.map((snapshot, index) => ({
      ...retrievalResult.results[0],
      productId: snapshot.productId,
      score: 0.9 - index * 0.1,
      rerankScore: 90 - index,
      payload: {
        ...retrievalResult.results[0].payload,
        productId: snapshot.productId,
        name: snapshot.name,
        slug: snapshot.slug,
        category: snapshot.category,
        categoryPath: snapshot.searchMetadata.categoryPath,
        price: snapshot.price,
        discountPrice: snapshot.discountPrice ?? snapshot.price,
        stock: snapshot.stock,
      },
    }));
    const fastCatalogAdapter = {
      getSnapshotsByIds: jest.fn().mockResolvedValue(badSnapshots),
      searchProducts: jest.fn().mockResolvedValue(retrievalResult),
      searchProductsFast: jest.fn().mockResolvedValue({
        ...retrievalResult,
        query: {
          ...retrievalResult.query,
          original: 'laptop tầm 25tr',
          constraints: { categoryHints: ['laptop'], maxPrice: 25_000_000 },
        },
        results: badResults,
      }),
    } as unknown as jest.Mocked<ProductCatalogAdapter>;

    const result = await productAdviceNode(
      {
        userText: 'laptop tầm 25tr',
        intentPlan: { needsProductRetrieval: true, broadNeed: false },
      },
      { productRetriever, catalogAdapter: fastCatalogAdapter },
    );

    expect(result.metadata.productCards.map((card) => card.name)).toEqual([
      'Laptop Gaming RTX 4060',
    ]);
    expect(result.metadata.productIds).toEqual(['64f100000000000000000001']);
  });
  it('CHAT-02 uses shared customer product card fields for productId, name, price, stock, slug, reasons, availability, and actionPayload', async () => {
    const result = await productAdviceNode(
      {
        userText: 'Goi y laptop RTX 4060',
        intentPlan: { needsProductRetrieval: true, broadNeed: false },
      },
      { productRetriever, catalogAdapter },
    );

    expect(result.metadata.productCards[0]).toMatchObject({
      productId: '64f100000000000000000001',
      name: 'Laptop Gaming RTX 4060',
      price: 24_990_000,
      stock: 4,
      slug: 'laptop-gaming-rtx-4060',
      image: 'https://cdn.gearvn.test/laptop-4060.jpg',
      reasons: [],
      availability: expect.objectContaining({ addable: true }),
      actionPayload: expect.objectContaining({
        productId: '64f100000000000000000001',
      }),
    });
    expect(result.metadata.productCards[0]).not.toHaveProperty('fitReason');
  });

  it('does not expose internal retrieval scoring reasons in product cards', async () => {
    productRetriever.search.mockResolvedValueOnce({
      ...retrievalResult,
      results: retrievalResult.results.map((result) => ({
        ...result,
        reasons: [
          {
            code: 'vector_score',
            message: 'Qdrant vector similarity baseline',
            weight: 1,
          },
          {
            code: 'bm25_score',
            message: 'Mongo lexical/spec score matched laptop, ai',
            weight: 1,
          },
          {
            code: 'keyword_match',
            message: 'Matched keywords: laptop, ai',
            weight: 1,
          },
        ],
      })),
    });

    const result = await productAdviceNode(
      {
        userText: 'Laptop học AI tầm 25 triệu',
        intentPlan: { needsProductRetrieval: true, broadNeed: false },
      },
      { productRetriever, catalogAdapter },
    );

    expect(result.metadata.productCards[0].reasons).toEqual([]);
  });

  it('uses the assistant chat model composer for product-advice final text when available', async () => {
    const responseComposer = {
      composeProductAdvice: jest
        .fn()
        .mockResolvedValue(
          'Mình gợi ý ưu tiên Laptop Gaming RTX 4060 vì còn hàng và khớp nhu cầu.',
        ),
    };

    const result = await productAdviceNode(
      {
        userText: 'Mua máy tính chơi game',
        intentPlan: { needsProductRetrieval: true, broadNeed: false },
      },
      {
        productRetriever,
        catalogAdapter,
        responseComposer: responseComposer as any,
      },
    );

    expect(responseComposer.composeProductAdvice).toHaveBeenCalledWith(
      expect.objectContaining({
        userText: 'Mua máy tính chơi game',
        productCards: expect.arrayContaining([
          expect.objectContaining({ name: 'Laptop Gaming RTX 4060' }),
        ]),
      }),
    );
    expect(result.text).toContain('Laptop Gaming RTX 4060');
    expect(result.text).not.toContain('Mình sẽ nói rõ vì sao');
    expect(result.text).not.toContain('Mình chọn mẫu này vì');
    expect(result.text).not.toContain('Với AI/ML');
    expect(result.metadata.llmComposed).toBe(true);
  });

  it('falls back to minimal catalog text when composer returns no usable text', async () => {
    const responseComposer = {
      composeProductAdvice: jest.fn().mockResolvedValue(null),
    };

    const result = await productAdviceNode(
      {
        userText: 'tầm 30 triệu đổ xuống, dùng để học AI/ML, ưu tiên mỏng nhẹ',
        intentPlan: { needsProductRetrieval: true, broadNeed: false },
      },
      {
        productRetriever,
        catalogAdapter,
        responseComposer: responseComposer as any,
      },
    );

    expect(responseComposer.composeProductAdvice).toHaveBeenCalled();
    expectDataDrivenProductAdviceFallback(result.text);
    expect(result.text).not.toContain('Mình sẽ nói rõ vì sao');
    expect(result.text).not.toContain('Mình chọn mẫu này vì');
    expect(result.text).not.toContain('Với AI/ML');
    expect(result.text).not.toContain('Khớp nhu cầu');
    expect(result.text).not.toContain('Cần cân nhắc');
    expect(result.text).not.toContain('Điểm phù hợp');
    expect(result.text).not.toContain('Điểm cần cân nhắc');
    expect(result.text).toMatch(/[.?]$/);
    expect(result.metadata.llmComposed).toBe(false);
  });

  it('keeps retrieval expansion out of customer-facing product advice fallback', async () => {
    const responseComposer = {
      composeProductAdvice: jest.fn().mockResolvedValue(null),
    };

    const result = await productAdviceNode(
      {
        userText: '30 triệu đổ xuống, học Machine Learning',
        parsedEntities: { productCategory: 'laptop' },
        intentPlan: { needsProductRetrieval: true, broadNeed: false },
      },
      {
        productRetriever,
        catalogAdapter,
        responseComposer: responseComposer as any,
      },
    );

    expect(productRetriever.search).toHaveBeenCalledWith(
      'rtx gpu laptop 30 triệu đổ xuống, học Machine Learning',
      expect.objectContaining({
        pipeline: 'phase-10-improved',
      }),
    );
    expect(responseComposer.composeProductAdvice).toHaveBeenCalledWith(
      expect.objectContaining({
        userText: 'laptop 30 triệu đổ xuống, học Machine Learning',
      }),
    );
    expectDataDrivenProductAdviceFallback(result.text);
    expect(result.text).not.toContain('nhóm gpu');
    expect(result.text).not.toContain('rtx gpu');
    expect(result.text).not.toContain('CUDA');
    expect(result.text).not.toContain('NVIDIA RTX');
  });

  it('sanitizes rude filler pronouns from deterministic advice context', async () => {
    const responseComposer = {
      composeProductAdvice: jest.fn().mockResolvedValue(null),
    };

    const result = await productAdviceNode(
      {
        userText: 'laptop 30 triệu, nhu cầu tao học machine learning',
        intentPlan: { needsProductRetrieval: true, broadNeed: false },
      },
      {
        productRetriever,
        catalogAdapter,
        responseComposer: responseComposer as any,
      },
    );

    expectDataDrivenProductAdviceFallback(result.text);
    expect(result.text).not.toContain('tao');
  });

  it('falls back to minimal catalog text when composer returns cut text', async () => {
    const responseComposer = {
      composeProductAdvice: jest
        .fn()
        .mockResolvedValue('Mình đang so sánh Laptop Gaming RTX 4060 vì'),
    };

    const result = await productAdviceNode(
      {
        userText: 'gợi ý 5 mẫu laptop',
        intentPlan: { needsProductRetrieval: true, broadNeed: false },
      },
      {
        productRetriever,
        catalogAdapter,
        responseComposer: responseComposer as any,
      },
    );

    expect(responseComposer.composeProductAdvice).toHaveBeenCalled();
    expectDataDrivenProductAdviceFallback(result.text);
    expect(result.text).not.toContain('Mình sẽ nói rõ vì sao');
    expect(result.text).not.toBe('Mình đang so sánh Laptop Gaming RTX 4060 vì');
    expect(result.text).toMatch(/[.!?]$/);
    expect(result.metadata.llmComposed).toBe(false);
    expect(result.metadata.llmComposeFallbackReason).toBe(
      'incomplete_composed_text',
    );
  });
  it('accepts subset count advice when three product cards render', async () => {
    const responseComposer = {
      composeProductAdvice: jest
        .fn()
        .mockResolvedValue(
          'Trong 3 thẻ bên dưới, mình ưu tiên 2 mẫu đáng cân nhắc nhất cho nhu cầu này.',
        ),
    };

    const result = await productAdviceNode(
      {
        userText: 'tư vấn laptop gaming khoảng 25 triệu',
        intentPlan: { needsProductRetrieval: true, broadNeed: false },
      },
      {
        productRetriever,
        catalogAdapter,
        responseComposer: responseComposer as any,
      },
    );

    expect(result.metadata.productCards).toHaveLength(3);
    expect(result.text).toContain('2 mẫu đáng cân nhắc');
    expect(result.metadata.llmComposed).toBe(true);
    expect(result.metadata.llmComposeStatus).toBe('used');
  });

  it('rejects complete composer text that claims a mismatched product count', async () => {
    const responseComposer = {
      composeProductAdvice: jest
        .fn()
        .mockResolvedValue(
          'Mình tìm thấy 4 mẫu phù hợp: Laptop Gaming RTX 4060, Laptop Student Ryzen, Laptop Office Intel và Laptop Thin Light.',
        ),
    };

    const result = await productAdviceNode(
      {
        userText:
          'gợi ý 5 mẫu laptop phù hợp học lập trình AI, trả lời gọn nhưng đủ 5 thẻ sản phẩm',
        intentPlan: { needsProductRetrieval: true, broadNeed: false },
      },
      {
        productRetriever,
        catalogAdapter,
        responseComposer: responseComposer as any,
      },
    );

    expect(responseComposer.composeProductAdvice).toHaveBeenCalled();
    expect(result.metadata.productCards).toHaveLength(5);
    expectDataDrivenProductAdviceFallback(result.text);
    expect(result.text).not.toMatch(/\b4\s+mẫu\b/i);
    const numberedLines = result.text.match(/\b\d+\.\s/g) ?? [];
    expect(numberedLines).toHaveLength(0);
    expect(result.metadata.llmComposed).toBe(false);
    expect(result.metadata.llmComposeFallbackReason).toBe(
      'count_claim_mismatch',
    );
  });

  it('rejects unsupported warranty claims when catalog lacks warranty facts', async () => {
    const responseComposer = {
      composeProductAdvice: jest
        .fn()
        .mockResolvedValue('Bảo hành 24 tháng chính hãng.'),
    };

    const result = await productAdviceNode(
      {
        userText: 'laptop này bảo hành mấy năm?',
        intentPlan: {
          needsProductRetrieval: true,
          broadNeed: false,
          contextualUserText:
            'so sánh laptop gaming dưới 25 triệu laptop này bảo hành mấy năm?',
        },
      },
      {
        productRetriever,
        catalogAdapter,
        responseComposer: responseComposer as any,
      },
    );

    expect(responseComposer.composeProductAdvice).toHaveBeenCalled();
    expectDataDrivenProductAdviceFallback(result.text);
    expect(result.text).not.toMatch(
      /lọc tiếp theo nhu cầu|24 tháng|chính hãng/i,
    );
    expect(result.metadata.llmComposed).toBe(false);
    expect(result.metadata.llmComposeFallbackReason).toBe(
      'unsupported_warranty_claim',
    );
  });
  it('CHAT-02 treats more-options follow-ups as continuation and keeps the rewritten query clean', async () => {
    const fastCatalogAdapter = {
      getSnapshotsByIds: jest.fn().mockResolvedValue(catalogSnapshots),
      searchProducts: jest.fn().mockResolvedValue(retrievalResult),
      searchProductsFast: jest.fn().mockResolvedValue(retrievalResult),
    } as unknown as jest.Mocked<ProductCatalogAdapter>;
    const result = await productAdviceNode(
      {
        userText: 'có máy khác nữa không',
        intentPlan: {
          needsProductRetrieval: true,
          requestedMoreOptions: true,
          contextualUserText:
            'laptop 30 triệu, học Machine Learning có máy khác nữa không',
        },
        parsedEntities: {
          productCategory: 'laptop',
          requestedMoreOptions: true,
        },
      },
      { productRetriever, catalogAdapter: fastCatalogAdapter },
    );

    expect(result.metadata.productCards).toHaveLength(5);
    expect(productRetriever.search).toHaveBeenCalledWith(
      'rtx gpu laptop 30 triệu, học Machine Learning',
      expect.objectContaining({
        pipeline: 'phase-10-improved',
      }),
    );
    expect(fastCatalogAdapter.searchProductsFast).not.toHaveBeenCalled();
    expect(result.metadata.productCards).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ productId: '64f100000000000000000002' }),
      ]),
    );
    const unavailableCard = result.metadata.productCards.find(
      (card) => card.productId === '64f100000000000000000003',
    )!;
    expect(unavailableCard.availability).toMatchObject({
      status: 'out_of_stock',
      addable: false,
    });
    expect(unavailableCard.actionPayload?.actions ?? []).not.toContain(
      'ADD_TO_CART',
    );
    expect(result.text).not.toContain('có máy khác nữa không');
  });

  it('records requested/applied limits and saves only final constrained cards to the ledger', async () => {
    const sessionService = {
      saveRecommendationLedger: jest.fn().mockResolvedValue({}),
    };

    const result = await productAdviceNode(
      {
        roomId: 'room-09-2-05',
        userText: 'gợi ý 5 mẫu laptop',
        intentPlan: { needsProductRetrieval: true, broadNeed: false },
      },
      {
        productRetriever,
        catalogAdapter,
        sessionService: sessionService as any,
      },
    );

    expect(result.metadata).toMatchObject({
      requested_recommendation_limit: 5,
      applied_recommendation_limit: 5,
      product_card_count: 5,
    });
    expect(sessionService.saveRecommendationLedger).toHaveBeenCalledWith(
      'room-09-2-05',
      result.metadata.productCards,
    );
    expect(result.metadata.productCards).toHaveLength(5);
    expect(result.metadata.productCards).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ productId: '64f100000000000000000002' }),
      ]),
    );
  });

  it('keeps max-limit fallback metadata bounded with minimal operational text', async () => {
    const previousMaxLimit = process.env.ASSISTANT_RECOMMENDATION_MAX_LIMIT;
    process.env.ASSISTANT_RECOMMENDATION_MAX_LIMIT = '6';

    try {
      const result = await productAdviceNode(
        {
          userText: 'gợi ý 20 mẫu laptop',
          intentPlan: { needsProductRetrieval: true, broadNeed: false },
        },
        { productRetriever, catalogAdapter },
      );

      expect(result.metadata.applied_recommendation_limit).toBe(6);
      expect(result.metadata.productCards).toHaveLength(6);
      const numberedLines = result.text.match(/\b\d+\.\s/g) ?? [];
      expect(numberedLines).toHaveLength(0);
      expectDataDrivenProductAdviceFallback(result.text);
    } finally {
      if (previousMaxLimit === undefined) {
        delete process.env.ASSISTANT_RECOMMENDATION_MAX_LIMIT;
      } else {
        process.env.ASSISTANT_RECOMMENDATION_MAX_LIMIT = previousMaxLimit;
      }
    }
  });

  it('CHAT-02 never invents discount, warranty, stock, or specs absent from catalog snapshots', async () => {
    const result = await productAdviceNode(
      {
        userText: 'Laptop nao co bao hanh va giam gia tot?',
        intentPlan: { needsProductRetrieval: true, broadNeed: false },
      },
      { productRetriever, catalogAdapter },
    );

    const cardWithoutOptionalFacts = result.metadata.productCards.find(
      (card) => card.productId === '64f100000000000000000003',
    )!;
    expect(cardWithoutOptionalFacts).not.toHaveProperty('discount');
    expect(cardWithoutOptionalFacts).not.toHaveProperty('warranty');
    expect(cardWithoutOptionalFacts.specs ?? {}).toEqual({});
    expect(cardWithoutOptionalFacts.stock).toBe(0);
  });

  it.each([
    ['gợi ý 5 mẫu laptop', 5, 5],
    ['cho mình 7 sản phẩm', 7, 6],
    ['recommend 4 con', 4, 4],
  ])(
    'parses requested recommendation limits from "%s", clamps to max, and keeps cards aligned',
    async (prompt, expectedTopK, expectedCount) => {
      const result = await productAdviceNode(
        {
          userText: prompt,
          intentPlan: { needsProductRetrieval: true, broadNeed: false },
        },
        { productRetriever, catalogAdapter },
      );

      expect(productRetriever.search).toHaveBeenCalledWith(
        prompt,
        expect.objectContaining({ topK: expectedTopK }),
      );
      expect(result.metadata.productCards).toHaveLength(expectedCount);
      const numberedLines = result.text.match(/\b\d+\.\s/g) ?? [];
      expect(numberedLines).toHaveLength(0);
      expectDataDrivenProductAdviceFallback(result.text);
    },
  );
});
