import {
  expandProductQuery,
  extractHardConstraints,
  rerankProducts,
} from './product-reranker';
import { ProductRetriever } from './product-retriever';
import { ProductCandidate } from './product-retrieval.types';

const IMPOSSIBLE_QUERY = 'laptop gaming RTX 4090 dưới 20 triệu';
const RELAXED_QUERY = 'laptop gaming dưới 20 triệu';

const basePayload = {
  productId: 'base',
  name: 'Base Product',
  slug: 'base-product',
  category: 'laptop',
  categoryPath: ['Laptop'],
  price: 18_000_000,
  discountPrice: 17_500_000,
  stock: 5,
  isPublished: true,
  isArchived: false,
  semanticTags: ['gaming'],
  useCases: ['gaming'],
  targetUsers: ['game thủ'],
  normalizedSpecs: {},
};

function candidate(
  productId: string,
  payload: Partial<typeof basePayload>,
  score = 0.75,
): ProductCandidate {
  return {
    productId,
    score,
    payload: {
      ...basePayload,
      ...payload,
      productId,
      slug: productId,
    },
  };
}

describe('ProductRetriever CRAG recovery contract', () => {
  it('rewrites impossible RTX 4090 budget queries once and returns grounded alternatives', async () => {
    const embedder = {
      embedQuery: jest
        .fn()
        .mockResolvedValueOnce({ vectors: [[0.1, 0.2, 0.3]] })
        .mockResolvedValueOnce({ vectors: [[0.4, 0.5, 0.6]] }),
    };
    const vector = {
      queryProducts: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          candidate('rtx-4060-laptop', {
            name: 'Laptop Gaming RTX 4060',
            price: 19_900_000,
            discountPrice: 18_990_000,
            normalizedSpecs: { gpu: 'NVIDIA RTX 4060', ram: '16GB' },
          }),
          candidate('rtx-4050-laptop', {
            name: 'Laptop Gaming RTX 4050',
            price: 18_900_000,
            discountPrice: 17_990_000,
            normalizedSpecs: { gpu: 'NVIDIA RTX 4050', ram: '16GB' },
          }),
        ]),
    };
    const retriever = new ProductRetriever(embedder, vector);

    const result = await retriever.search(IMPOSSIBLE_QUERY, { topK: 3 });

    expect(embedder.embedQuery).toHaveBeenCalledTimes(2);
    expect(embedder.embedQuery.mock.calls[1][0]).toContain(RELAXED_QUERY);
    expect(vector.queryProducts).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      query: expect.objectContaining({
        original: IMPOSSIBLE_QUERY,
      }),
      crag_retry: expect.objectContaining({
        triggered: true,
        retryCount: 1,
        rewrittenQuery: RELAXED_QUERY,
      }),
    });
    expect(result.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productId: 'rtx-4060-laptop',
          payload: expect.objectContaining({ name: 'Laptop Gaming RTX 4060' }),
        }),
      ]),
    );
  });

  it('never exceeds one CRAG retry for weak retrieval results', async () => {
    const embedder = {
      embedQuery: jest
        .fn()
        .mockResolvedValueOnce({ vectors: [[0.1, 0.2, 0.3]] })
        .mockResolvedValueOnce({ vectors: [[0.4, 0.5, 0.6]] }),
    };
    const vector = {
      queryProducts: jest.fn().mockResolvedValue([]),
    };
    const retriever = new ProductRetriever(embedder, vector);

    const result = await retriever.search(IMPOSSIBLE_QUERY, { topK: 3 });

    expect(embedder.embedQuery).toHaveBeenCalledTimes(2);
    expect(vector.queryProducts).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      crag_retry: expect.objectContaining({
        triggered: true,
        retryCount: 1,
      }),
    });
  });
  it('keeps deterministic PC constraints authoritative when rewrite drifts to phones', async () => {
    const embedder = {
      embedQuery: jest.fn().mockResolvedValue({ vectors: [[0.1, 0.2, 0.3]] }),
    };
    const vector = {
      queryProducts: jest.fn().mockResolvedValue([
        candidate('phone-with-pc-like-spec-text', {
          name: 'Samsung Galaxy A71',
          category: 'dien-thoai',
          categoryPath: ['Điện thoại', 'Samsung'],
          price: 7_700_000,
          discountPrice: 7_700_000,
          normalizedSpecs: {
            camera: '64MPCamera',
            cpu: 'Qualcomm Snapdragon',
            ram: '8 GB',
          },
        }),
        candidate('pc-component-rtx', {
          name: 'VGA ASUS Dual GeForce RTX 4060',
          category: 'linh-kien-may-tinh',
          categoryPath: ['Linh kiện máy tính', 'VGA'],
          price: 9_990_000,
          discountPrice: 9_490_000,
          normalizedSpecs: { gpu: 'NVIDIA RTX 4060', ram: '16GB' },
        }),
      ]),
    };
    const queryRewriteService = {
      rewrite: jest.fn().mockResolvedValue({
        rewrittenQuery: 'điện thoại CAD RAM 16GB dưới 30 triệu',
        detectedIntents: ['ENGINEERING_CAD'],
        productGroups: ['phone'],
        hardConstraints: {
          category: 'phone',
          categoryHints: ['phone'],
          maxPrice: 30_000_000,
          requiredSpecs: { ramGb: 16, gpu: 'nvidia' },
        },
        softSignals: ['workstation'],
        expandedKeywords: ['phone', 'RAM 16GB'],
        comboGroups: [],
        clarificationNeeded: false,
        clarificationReason: null,
        metadata: {
          rewrite_provider: 'deepseek',
          rewrite_model: 'deepseek-v4-pro',
          rewrite_status: 'success',
          rewrite_retry_count: 0,
          rewrite_latency_ms: 1,
          rewritten_query: 'điện thoại CAD RAM 16GB dưới 30 triệu',
        },
      }),
    };
    const retriever = new ProductRetriever(
      embedder,
      vector,
      undefined,
      queryRewriteService,
    );

    const result = await retriever.search(
      'bộ PC tầm 30 triệu làm CAD kỹ thuật',
      {
        topK: 5,
        hardConstraints: { categoryHints: ['pc'], maxPrice: 30_000_000 },
        pipeline: 'phase-10-improved',
      },
    );

    expect(
      vector.queryProducts.mock.calls[0][1].filters.category,
    ).toBeUndefined();
    expect(result.query.constraints).toMatchObject({ categoryHints: ['pc'] });
    expect(result.results.map((item) => item.productId)).toEqual([
      'pc-component-rtx',
    ]);
  });
});

describe('product reranker hard shopping constraints', () => {
  it('extracts approximate Vietnamese budgets as max-price constraints', () => {
    expect(
      extractHardConstraints('tầm 25 triệu, nhu cầu học AI/Machine Learning'),
    ).toMatchObject({
      maxPrice: 25_000_000,
    });
    expect(
      extractHardConstraints('mình có tối đa 25 triệu thôi'),
    ).toMatchObject({ maxPrice: 25_000_000 });
    expect(extractHardConstraints('khoảng 20-25 triệu')).toMatchObject({
      maxPrice: 25_000_000,
    });
    expect(extractHardConstraints('laptop tầm 25tr')).toMatchObject({
      categoryHints: ['laptop'],
      maxPrice: 25_000_000,
    });
    expect(extractHardConstraints('đừng quá 25m')).toMatchObject({
      maxPrice: 25_000_000,
    });
    expect(
      extractHardConstraints('màn hình 2K màu tốt tầm 7 triệu'),
    ).toMatchObject({
      categoryHints: ['monitor'],
      maxPrice: 7_000_000,
      requiredSpecs: { displayResolution: '2k' },
    });
  });
  it('enforces monitor display resolution so Full HD cards do not satisfy 2K requests', () => {
    const results = rerankProducts(
      'màn hình 2K màu tốt tầm 7 triệu',
      [
        candidate('full-hd-monitor', {
          name: 'Màn hình Full HD IPS 27 inch',
          category: 'Màn hình',
          categoryPath: ['Màn hình'],
          price: 4_990_000,
          discountPrice: 4_790_000,
          normalizedSpecs: { resolution: 'Full HD 1920x1080', panel: 'IPS' },
        }),
        candidate('qhd-monitor', {
          name: 'Màn hình 2K QHD IPS 27 inch',
          category: 'Màn hình',
          categoryPath: ['Màn hình'],
          price: 6_990_000,
          discountPrice: 6_790_000,
          normalizedSpecs: { resolution: '2560x1440 QHD', panel: 'IPS' },
        }),
      ],
      { topK: 5, enforceRequiredSpecs: true },
    );

    expect(results.map((result) => result.productId)).toEqual(['qhd-monitor']);
  });
  it('applies Phase 10 intent primitive expansion and constraints for AI learning laptops', () => {
    expect(expandProductQuery('laptop học AI')).toEqual(
      expect.arrayContaining([
        'CUDA',
        'NVIDIA',
        'RTX',
        'RAM 16GB',
        'sinh viên IT',
      ]),
    );
    expect(extractHardConstraints('laptop học AI')).toMatchObject({
      categoryHints: ['laptop'],
      requiredSpecs: {
        ramGb: 16,
        ssdGb: 512,
        gpu: 'nvidia',
      },
    });
  });

  it('filters expensive and off-category products for laptop budget advice', () => {
    const results = rerankProducts(
      'rtx gpu laptop tầm 25 triệu học AI/Machine Learning',
      [
        candidate('expensive-laptop', {
          name: 'Laptop ASUS Gaming ROG Zephyrus G16',
          price: 117_990_000,
          discountPrice: 117_990_000,
          normalizedSpecs: { gpu: 'NVIDIA RTX 4070', ram: '32GB' },
        }),
        candidate('budget-laptop', {
          name: 'Laptop Gaming RTX 4060',
          price: 24_990_000,
          discountPrice: 24_990_000,
          normalizedSpecs: { gpu: 'NVIDIA RTX 4060', ram: '16GB' },
        }),
        candidate('phone-under-budget', {
          name: 'iPhone 15 128GB',
          category: 'Điện thoại',
          categoryPath: ['Điện thoại'],
          price: 17_590_000,
          discountPrice: 17_590_000,
        }),
        candidate('desktop-mac-under-budget', {
          name: 'Mac mini M4 2024 10CPU 10GPU 16GB 256GB',
          category: 'laptop',
          categoryPath: ['Laptop', 'Mac', 'Mac mini'],
          price: 14_990_000,
          discountPrice: 14_990_000,
          normalizedSpecs: {
            gpu: 'GPU 10 lõi',
            ram: '16GB',
          },
        }),
      ],
      { topK: 5 },
    );

    expect(results.map((result) => result.productId)).toEqual([
      'budget-laptop',
    ]);
  });

  it('keeps explicit PC advice on desktop/category-relevant candidates without laptop fallback', () => {
    const results = rerankProducts(
      'bộ PC tầm 30 triệu làm CAD kỹ thuật',
      [
        candidate('pc-name-match', {
          name: 'PC GVN Workstation Ryzen RTX 4060',
          category: '',
          categoryPath: [],
          price: 29_990_000,
          discountPrice: 29_990_000,
          normalizedSpecs: { gpu: 'NVIDIA RTX 4060', ram: '32GB' },
        }),
        candidate('pc-component-match', {
          name: 'CPU AMD Ryzen 7 7700',
          category: 'linh-kien-may-tinh',
          categoryPath: ['Linh kiện máy tính', 'CPU'],
          price: 7_490_000,
          discountPrice: 7_290_000,
          normalizedSpecs: { socket: 'AM5', cores: 8 },
        }),
        candidate('phone-camera-false-positive', {
          name: 'Samsung Galaxy A71',
          category: 'Điện thoại',
          categoryPath: ['Điện thoại', 'Samsung'],
          price: 9_990_000,
          discountPrice: 8_990_000,
          normalizedSpecs: { camera: '64MPCamera', ram: '8GB' },
        }),
        candidate('laptop-off-category', {
          name: 'Laptop Gaming RTX 4060',
          category: 'Laptop',
          categoryPath: ['Laptop'],
          price: 24_990_000,
          discountPrice: 24_990_000,
          normalizedSpecs: { gpu: 'NVIDIA RTX 4060', ram: '16GB' },
        }),
      ],
      { topK: 5, constraints: { categoryHints: ['pc'], maxPrice: 30_000_000 } },
    );

    expect(results.map((result) => result.productId)).toEqual([
      'pc-name-match',
      'pc-component-match',
    ]);
  });

  it.each([
    {
      label: 'phone',
      hint: 'phone',
      original: 'tư vấn iPhone tầm 20 triệu',
      good: candidate('phone-match', {
        name: 'iPhone 15 128GB',
        category: 'Điện thoại',
        categoryPath: ['Điện thoại', 'Apple'],
      }),
    },
    {
      label: 'webcam',
      hint: 'webcam',
      original: 'cần webcam học online',
      good: candidate('webcam-match', {
        name: 'Webcam Logitech Brio 500',
        category: 'Webcam',
        categoryPath: ['Webcam'],
      }),
    },
    {
      label: 'microphone',
      hint: 'microphone',
      original: 'gợi ý micro thu âm',
      good: candidate('microphone-match', {
        name: 'Microphone HyperX QuadCast',
        category: 'Microphone',
        categoryPath: ['Microphone'],
      }),
    },
    {
      label: 'chair',
      hint: 'chair',
      original: 'tư vấn ghế gaming',
      good: candidate('chair-match', {
        name: 'Ghế gaming Corsair TC100',
        category: 'Ghế gaming',
        categoryPath: ['Ghế gaming'],
      }),
    },
    {
      label: 'accessory',
      hint: 'accessory',
      original: 'cần phụ kiện GearVN',
      good: candidate('accessory-match', {
        name: 'Bộ phụ kiện laptop Ugreen',
        category: 'Phụ kiện',
        categoryPath: ['Phụ kiện'],
      }),
    },
    {
      label: 'storage',
      hint: 'storage',
      original: 'gợi ý ổ cứng SSD 1TB',
      good: candidate('storage-match', {
        name: 'SSD Samsung 990 EVO 1TB',
        category: 'Ổ cứng SSD',
        categoryPath: ['Linh kiện máy tính', 'Ổ cứng SSD'],
      }),
    },
  ])(
    'keeps explicit $label constraints authoritative when rewrite drifts to laptop',
    ({ hint, original, good }) => {
      const results = rerankProducts(
        'laptop gaming RTX 4060 dưới 30 triệu',
        [
          candidate('drifted-laptop', {
            name: 'Laptop Gaming RTX 4060',
            category: 'Laptop',
            categoryPath: ['Laptop'],
            normalizedSpecs: { gpu: 'NVIDIA RTX 4060', ram: '16GB' },
          }),
          good,
        ],
        { topK: 5, constraints: { categoryHints: [hint] } },
      );

      expect(extractHardConstraints(original)).toMatchObject({
        categoryHints: [hint],
      });
      expect(results.map((result) => result.productId)).toEqual([
        good.productId,
      ]);
    },
  );
  it('rejects under-spec RAM and SSD products even when unrelated specs contain matching numbers', () => {
    const results = rerankProducts(
      'laptop học AI RAM 16GB SSD 512GB',
      [
        candidate('screen-size-match-only', {
          name: 'Laptop Gaming 16 inch',
          price: 22_990_000,
          discountPrice: 22_990_000,
          normalizedSpecs: {
            gpu: 'NVIDIA RTX 4050',
            ram: '8GB',
            screenSize: '16 inch',
            ssd: '512GB',
          },
        }),
        candidate('storage-count-match-only', {
          name: 'Laptop Gaming RTX 4050',
          price: 21_990_000,
          discountPrice: 21_990_000,
          normalizedSpecs: {
            gpu: 'NVIDIA RTX 4050',
            ram: '16GB',
            ports: '512 kết nối',
            ssd: '256GB',
          },
        }),
        candidate('qualified-laptop', {
          name: 'Laptop Gaming RTX 4060',
          price: 24_990_000,
          discountPrice: 24_990_000,
          normalizedSpecs: {
            gpu: 'NVIDIA RTX 4060',
            ram: '16GB',
            ssd: '512GB',
          },
        }),
      ],
      {
        constraints: {
          categoryHints: ['laptop'],
          requiredSpecs: { ramGb: 16, ssdGb: 512 },
        },
        enforceRequiredSpecs: true,
        topK: 5,
      },
    );

    expect(results.map((result) => result.productId)).toEqual([
      'qualified-laptop',
    ]);
  });
  it('treats concrete GPU model mentions as hard specs when enforced', () => {
    expect(
      extractHardConstraints('laptop RTX 4090 dưới 20 triệu'),
    ).toMatchObject({
      categoryHints: ['laptop'],
      maxPrice: 20_000_000,
      requiredSpecs: { gpu: 'rtx 4090' },
    });

    const results = rerankProducts(
      'laptop RTX 4090 dưới 20 triệu',
      [
        candidate('rtx-4060-under-budget', {
          name: 'Laptop Gaming RTX 4060',
          price: 19_900_000,
          discountPrice: 18_990_000,
          normalizedSpecs: { gpu: 'NVIDIA RTX 4060', ram: '16GB' },
        }),
        candidate('rtx-4090-over-budget', {
          name: 'Laptop Gaming RTX 4090',
          price: 89_900_000,
          discountPrice: 85_990_000,
          normalizedSpecs: { gpu: 'NVIDIA RTX 4090', ram: '32GB' },
        }),
      ],
      { topK: 5, enforceRequiredSpecs: true },
    );

    expect(results).toEqual([]);
  });
});
