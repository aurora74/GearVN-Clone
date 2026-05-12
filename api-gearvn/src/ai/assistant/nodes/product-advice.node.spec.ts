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
    await productAdviceNode(
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

  it('CHAT-02 D-13 asks follow-up questions before retrieval for broad needs', async () => {
    const responseComposer = {
      composeProductClarification: jest.fn(),
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
    expect(result.text).toMatch(/ngân sách|nhu cầu|mục đích|màn hình/i);
    expect(responseComposer.composeProductClarification).not.toHaveBeenCalled();
    expect(result.metadata.productCards).toHaveLength(0);
    expect(result.metadata.followUpQuestions).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/ngân sách|nhu cầu|màn hình|game/i),
      ]),
    );
    expect(result.metadata.needsClarification).toBe(true);
    expect(result.metadata.llmComposed).toBe(false);
  });

  it('falls back to static broad-need clarification when composer is unavailable', async () => {
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

    await productAdviceNode(
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
  });

  it('uses contextual user text from supervisor for continuation turns', async () => {
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

    expect(fastCatalogAdapter.searchProductsFast).toHaveBeenCalledWith(
      'rtx gpu laptop Ngân sách 25 triệu, dùng để học machine learning/AI, ưu tiên hiệu năng',
      expect.objectContaining({ topK: 3 }),
    );
    expect(productRetriever.search).not.toHaveBeenCalled();
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
    expect(result.text).toContain('ngân sách khoảng 40 triệu');
    expect(result.text).toContain('40 triệu');
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
    expect(result.text).toContain('sản phẩm vừa hiển thị');
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

    expect(fastCatalogAdapter.searchProductsFast).toHaveBeenCalledWith(
      'rtx gpu laptop tầm 25 triệu, nhu cầu học AI/Machine Learning mình có tối đa 25 triệu thôi, tìm cho mình',
      expect.objectContaining({ topK: 3 }),
    );
    expect(productRetriever.search).not.toHaveBeenCalled();
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
  it('CHAT-02 uses shared customer product card fields for productId, name, price, stock, slug, image, reasons, availability, and actionPayload', async () => {
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
      reasons: expect.arrayContaining([expect.stringContaining('Phù hợp')]),
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

    expect(result.metadata.productCards[0].reasons).toEqual([
      'Phù hợp với nhu cầu đã nêu.',
    ]);
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
    expect(result.metadata.llmComposed).toBe(true);
  });

  it('falls back to complete deterministic text when composer returns no usable text', async () => {
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
    expect(result.text).toContain('học AI/ML');
    expect(result.text).toContain('Laptop Gaming RTX 4060');
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
      expect.stringContaining('rtx gpu'),
      expect.anything(),
    );
    expect(responseComposer.composeProductAdvice).toHaveBeenCalledWith(
      expect.objectContaining({
        userText: 'laptop 30 triệu đổ xuống, học Machine Learning',
      }),
    );
    expect(result.text).toContain('nhóm laptop');
    expect(result.text).toContain('học Machine Learning');
    expect(result.text).not.toContain('nhóm gpu');
    expect(result.text).not.toContain('rtx gpu');
    expect(result.text).not.toContain('CUDA');
    expect(result.text).not.toContain('NVIDIA RTX');
  });

  it('falls back to complete deterministic text when composer returns cut text', async () => {
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
    expect(result.text).toContain('catalog GearVN');
    expect(result.text).not.toBe('Mình đang so sánh Laptop Gaming RTX 4060 vì');
    expect(result.text).toMatch(/[.!?]$/);
    expect(result.metadata.llmComposed).toBe(false);
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
    expect(result.text).toContain('catalog GearVN');
    expect(result.text).not.toMatch(/\b4\s+mẫu\b/i);
    const numberedLines = result.text.match(/\b\d+\.\s/g) ?? [];
    expect(numberedLines).toHaveLength(5);
    for (const card of result.metadata.productCards) {
      expect(result.text).toContain(card.name);
    }
    expect(result.metadata.llmComposed).toBe(false);
  });

  it('uses grounded missing-warranty wording and skips composer when catalog lacks warranty facts', async () => {
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

    expect(responseComposer.composeProductAdvice).not.toHaveBeenCalled();
    expect(result.text).toMatch(/chưa thấy dữ liệu thời hạn bảo hành/i);
    expect(result.text).toMatch(/chưa thể khẳng định số năm bảo hành/i);
    expect(result.text).toContain('Laptop Gaming RTX 4060');
    expect(result.text).not.toMatch(
      /lọc tiếp theo nhu cầu|24 tháng|chính hãng/i,
    );
    expect(result.metadata.llmComposed).toBe(false);
  });
  it('CHAT-02 blocks ADD_TO_CART for unavailable products, filters hard constraints, and caps more-options productCards at 5', async () => {
    const result = await productAdviceNode(
      {
        userText: 'Cho xem them lua chon laptop',
        intentPlan: { needsProductRetrieval: true, requestedMoreOptions: true },
      },
      { productRetriever, catalogAdapter },
    );

    expect(result.metadata.productCards).toHaveLength(5);
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

  it('keeps max-limit fallback text count-matched and bounded', async () => {
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
      expect(numberedLines).toHaveLength(6);
      expect(result.text.length).toBeLessThan(900);
      expect(result.text).toMatch(/[.!?]$/);
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
    'parses requested recommendation limits from "%s", clamps to max, and keeps cards/text count aligned',
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
      expect(numberedLines).toHaveLength(result.metadata.productCards.length);
      expect(result.text).toMatch(/[.!?]$/);
    },
  );
});
