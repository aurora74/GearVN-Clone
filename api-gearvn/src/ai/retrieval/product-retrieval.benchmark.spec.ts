import {
  expandProductQuery,
  extractHardConstraints,
  rerankProducts,
} from './product-reranker';
import { productRetrievalBenchmarkCases } from './product-retrieval.benchmark-cases';
import {
  failureRate,
  meanReciprocalRank,
  ndcgAtK,
  precisionAtK,
  recallAtK,
  runProductRetrievalBenchmark,
} from './product-retrieval.benchmark';
import {
  expandQueryNode,
  embedQueryNode,
  productRetrievalGraph,
  rerankNode,
  vectorSearchNode,
} from './product-retrieval.graph';
import { ProductRetriever } from './product-retriever';
import { ProductCandidate } from './product-retrieval.types';

const basePayload = {
  productId: 'base',
  name: 'Base Product',
  slug: 'base-product',
  category: 'misc',
  categoryPath: ['Phu kien'],
  price: 1_000_000,
  discountPrice: 900_000,
  stock: 1,
  isPublished: true,
  isArchived: false,
  semanticTags: [],
  useCases: [],
  targetUsers: [],
};

describe('deterministic product retrieval reranker', () => {
  it('expands keyword, need-based, gift, technical, combo, and ambiguous Vietnamese queries locally', () => {
    expect(expandProductQuery('iPhone')).toEqual(
      expect.arrayContaining(['iphone']),
    );
    expect(expandProductQuery('laptop học AI')).toEqual(
      expect.arrayContaining(['lap trinh ai', 'gpu nvidia', 'ram 16gb']),
    );
    expect(expandProductQuery('máy làm đồ họa')).toEqual(
      expect.arrayContaining(['creator', 'do hoa', 'gpu nvidia']),
    );
    expect(expandProductQuery('quà cho bạn trai thích game')).toEqual(
      expect.arrayContaining(['gaming', 'qua tang', 'ban trai']),
    );
    expect(expandProductQuery('laptop RAM 16GB SSD 512GB GPU NVIDIA')).toEqual(
      expect.arrayContaining(['ram 16gb', 'ssd 512gb', 'gpu nvidia']),
    );
    expect(expandProductQuery('máy mạnh giá tốt')).toEqual(
      expect.arrayContaining(['hieu nang', 'gia tot']),
    );
  });

  it('extracts price, stock, category, and spec hard constraints without LLM calls', () => {
    expect(
      extractHardConstraints(
        'laptop RAM 16GB SSD 512GB GPU NVIDIA dưới 25 triệu còn hàng',
      ),
    ).toEqual(
      expect.objectContaining({
        maxPrice: 25_000_000,
        inStockOnly: true,
        categoryHints: expect.arrayContaining(['laptop']),
        requiredSpecs: expect.objectContaining({
          ramGb: 16,
          ssdGb: 512,
          gpu: 'nvidia',
        }),
      }),
    );
  });

  it('orders candidates by exact, category, spec, price, and stock compatibility reasons', () => {
    const candidates = [
      candidate('office-monitor', {
        name: 'Dell U2724DE Comfort Monitor',
        category: 'monitor',
        price: 8_000_000,
        stock: 3,
        semanticTags: ['eye comfort'],
      }),
      candidate('ai-laptop', {
        name: 'RTX Laptop AI 16GB 512GB',
        category: 'laptop',
        price: 24_000_000,
        stock: 4,
        semanticTags: ['lap trinh ai', 'gpu nvidia'],
        useCases: ['lap trinh AI'],
        normalizedSpecs: { ramGb: 16, ssdGb: 512, gpu: 'NVIDIA RTX 4060' },
      }),
    ];

    const result = rerankProducts(
      'laptop học AI RAM 16GB SSD 512GB GPU NVIDIA dưới 25 triệu còn hàng',
      candidates,
    );

    expect(result[0].productId).toBe('ai-laptop');
    expect(result[0].reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'category_match' }),
        expect.objectContaining({ code: 'spec_match' }),
        expect.objectContaining({ code: 'price_compatible' }),
        expect.objectContaining({ code: 'in_stock' }),
      ]),
    );
    expect(result).toHaveLength(1);
  });

  it('filters out stock-incompatible candidates when the query requires availability', () => {
    const result = rerankProducts('bàn phím cơ wireless còn hàng', [
      candidate('sold-out-keyboard', {
        name: 'Wireless Mechanical Keyboard',
        category: 'keyboard',
        stock: 0,
        semanticTags: ['ban phim co wireless'],
      }),
      candidate('ready-keyboard', {
        name: 'Bàn phím cơ wireless',
        category: 'keyboard',
        stock: 8,
        semanticTags: ['ban phim co wireless'],
      }),
    ]);

    expect(result.map((item) => item.productId)).toEqual(['ready-keyboard']);
  });

  it('excludes under-spec candidates even when their vector score is higher', () => {
    const underSpec = {
      ...candidate('under-spec-laptop', {
        name: 'Popular Laptop 8GB 256GB Intel 60Hz wired',
        category: 'laptop',
        normalizedSpecs: {
          ram: '8GB',
          ssd: '256GB',
          gpu: 'Intel Iris Xe',
          display: '60Hz',
          connectivity: 'wired',
        },
      }),
      score: 0.99,
    };
    const compliant = {
      ...candidate('compliant-laptop', {
        name: 'RTX Laptop 16GB 512GB 144Hz Wireless',
        category: 'laptop',
        normalizedSpecs: {
          ram: '16GB',
          ssd: '512GB',
          gpu: 'NVIDIA RTX 4060',
          display: '144Hz',
          connectivity: 'Wi-Fi 6 Bluetooth wireless',
        },
      }),
      score: 0.2,
    };

    const result = rerankProducts(
      'laptop RAM 16GB SSD 512GB GPU NVIDIA 144Hz wireless',
      [underSpec, compliant],
      { enforceRequiredSpecs: true },
    );

    expect(result.map((item) => item.productId)).toEqual(['compliant-laptop']);
  });
  it('keeps reranking pure without invoking embedding or vector clients', () => {
    const embedQuery = jest.fn();
    const queryProducts = jest.fn();

    rerankProducts('màn hình 144Hz', [
      candidate('monitor-144hz', {
        name: 'Gaming Monitor 144Hz',
        category: 'monitor',
        normalizedSpecs: { refreshRateHz: 144 },
      }),
    ]);

    expect(embedQuery).not.toHaveBeenCalled();
    expect(queryProducts).not.toHaveBeenCalled();
  });
});

describe('ProductRetriever', () => {
  it('embeds expanded query text, queries Qdrant, and returns reranked normalized candidates', async () => {
    const embedder = {
      embedQuery: jest.fn().mockResolvedValue({
        vectors: [[0.1, 0.2, 0.3]],
        model: 'baai/bge-m3',
        vectorSize: 3,
        batchCount: 1,
      }),
    };
    const vector = {
      queryProducts: jest.fn().mockResolvedValue([
        {
          ...candidate('under-spec-laptop', {
            name: 'Popular Laptop 8GB 256GB Intel',
            category: 'laptop',
            price: 20_000_000,
            stock: 5,
            normalizedSpecs: { ram: '8GB', ssd: '256GB', gpu: 'Intel Iris Xe' },
          }),
          score: 0.99,
        },
        {
          ...candidate('ai-laptop', {
            name: 'RTX Laptop AI 16GB 512GB',
            category: 'laptop',
            price: 24_000_000,
            stock: 5,
            semanticTags: ['lap trinh ai', 'gpu nvidia'],
            normalizedSpecs: { ram: '16GB', ssd: '512GB', gpu: 'NVIDIA RTX 4060' },
          }),
          score: 0.2,
        },
      ]),
    };
    const retriever = new ProductRetriever(embedder, vector);

    const result = await retriever.search('laptop học AI RAM 16GB', {
      topK: 5,
      filters: { inStockOnly: true },
      hardConstraints: { requiredSpecs: { ssdGb: 512, gpu: 'nvidia' } },
    });

    expect(embedder.embedQuery.mock.calls[0][0]).toContain('lap trinh ai');
    expect(vector.queryProducts).toHaveBeenCalledWith(
      [0.1, 0.2, 0.3],
      expect.objectContaining({
        limit: 30,
        filters: expect.objectContaining({ inStockOnly: true }),
      }),
    );
    expect(result.query.constraints.requiredSpecs).toEqual(
      expect.objectContaining({ ramGb: 16, ssdGb: 512, gpu: 'nvidia' }),
    );
    expect(result.results[0]).toEqual(
      expect.objectContaining({
        productId: 'ai-laptop',
        payload: expect.objectContaining({ productId: 'ai-laptop' }),
        reasons: expect.arrayContaining([
          expect.objectContaining({ code: 'spec_match' }),
        ]),
      }),
    );
  });
});

describe('retrieval benchmark cases and metrics', () => {
  it('defines 10-20 cases across keyword, need-based, gift, technical, combo, and ambiguous groups', () => {
    expect(productRetrievalBenchmarkCases.length).toBeGreaterThanOrEqual(10);
    expect(productRetrievalBenchmarkCases.length).toBeLessThanOrEqual(20);
    expect(
      new Set(productRetrievalBenchmarkCases.map((item) => item.group)),
    ).toEqual(
      new Set([
        'keyword',
        'need_based',
        'gift',
        'technical',
        'combo',
        'ambiguous',
      ]),
    );
    expect(productRetrievalBenchmarkCases.map((item) => item.query)).toEqual(
      expect.arrayContaining([
        'iPhone',
        'MacBook',
        'RTX laptop',
        'màn hình Dell',
        'laptop học AI',
        'máy làm đồ họa',
        'setup làm việc tại nhà',
        'màn hình đỡ mỏi mắt',
        'quà cho bạn trai thích game',
        'quà cho sinh viên IT',
        'laptop RAM 16GB SSD 512GB GPU NVIDIA',
        'màn hình 144Hz',
        'bàn phím cơ wireless',
        'góc livestream',
        'bộ làm việc tại nhà',
        'máy mạnh giá tốt',
      ]),
    );
  });

  it('computes Recall@10, Precision@5, MRR, nDCG@10, and Failure Rate deterministically', () => {
    const ranked = ['p1', 'p2', 'p3', 'p4', 'p5'];
    const relevant = new Set(['p2', 'p4']);

    expect(recallAtK(ranked, relevant, 10)).toBe(1);
    expect(precisionAtK(ranked, relevant, 5)).toBe(0.4);
    expect(meanReciprocalRank([ranked], [relevant])).toBe(0.5);
    expect(ndcgAtK(ranked, relevant, 10)).toBeCloseTo(0.6509, 4);
    expect(
      failureRate([{ relevantFound: true }, { relevantFound: false }]),
    ).toBe(0.5);
  });

  it('runs benchmark reports with per-query topK products and metric labels', async () => {
    const retriever = {
      search: jest.fn().mockResolvedValue({
        results: [
          candidate('ai-laptop', {
            name: 'RTX Laptop AI',
            category: 'laptop',
            categoryPath: ['Laptop'],
            price: 24_000_000,
            stock: 3,
          }),
        ].map((item) => ({ ...item, rerankScore: 7, reasons: [] })),
      }),
    };

    const report = await runProductRetrievalBenchmark(
      retriever as unknown as ProductRetriever,
      [
        {
          id: 'case-1',
          query: 'laptop học AI',
          group: 'need_based',
          expectedCategories: ['laptop'],
          expectedProductIds: ['ai-laptop'],
        },
      ],
    );

    expect(report.summary).toEqual(
      expect.objectContaining({
        'Recall@10': 1,
        'Precision@5': 0.2,
        MRR: 1,
        'nDCG@10': 1,
        'Failure Rate': 0,
      }),
    );
    expect(report.results[0]).toEqual(
      expect.objectContaining({
        caseId: 'case-1',
        topK: [expect.objectContaining({ productId: 'ai-laptop', score: 7 })],
        metrics: expect.objectContaining({ 'Recall@10': 1 }),
      }),
    );
  });
  it('uses stable corpus relevance for category-only benchmark cases', async () => {
    const retriever = {
      search: jest.fn().mockResolvedValue({
        results: [
          candidate('ai-laptop', {
            name: 'RTX Laptop AI',
            category: 'laptop',
            categoryPath: ['Laptop'],
          }),
        ].map((item) => ({ ...item, rerankScore: 7, reasons: [] })),
      }),
    };

    const report = await runProductRetrievalBenchmark(
      retriever as unknown as ProductRetriever,
      [
        {
          id: 'case-1',
          query: 'laptop học AI',
          group: 'need_based',
          expectedCategories: ['laptop'],
        },
      ],
      {
        relevanceCorpus: [
          candidate('ai-laptop', { category: 'laptop', categoryPath: ['Laptop'] }).payload,
          candidate('other-laptop', { category: 'laptop', categoryPath: ['Laptop'] }).payload,
          candidate('monitor', { category: 'monitor', categoryPath: ['Monitor'] }).payload,
        ],
      },
    );

    expect(report.results[0].metrics).toEqual(
      expect.objectContaining({
        'Recall@10': 0.5,
        'Precision@5': 0.2,
        MRR: 1,
      }),
    );
  });
});

describe('productRetrievalGraph', () => {
  it('exports explicit LangGraph node helpers for expand, embed, vector search, and rerank', async () => {
    await expect(expandQueryNode({ query: 'màn hình 144Hz' })).resolves.toEqual(
      expect.objectContaining({
        expandedQueries: expect.arrayContaining(['144hz']),
      }),
    );
    await expect(
      embedQueryNode(
        { query: 'màn hình 144Hz', expandedQueries: ['144hz'] },
        {
          configurable: {
            embedder: {
              embedQuery: jest.fn().mockResolvedValue({ vectors: [[0.9]] }),
            },
          },
        },
      ),
    ).resolves.toEqual({ embedding: [0.9] });
    const queryProducts = jest.fn().mockResolvedValue([]);
    await expect(
      vectorSearchNode(
        { embedding: [0.9], topK: 3 },
        {
          configurable: {
            vector: { queryProducts },
          },
        },
      ),
    ).resolves.toEqual({ candidates: [] });
    expect(queryProducts).toHaveBeenCalledWith([0.9], {
      limit: 30,
      filters: expect.objectContaining({}),
    });
    await expect(
      rerankNode({
        query: 'màn hình 144Hz',
        candidates: [candidate('monitor-144hz', { category: 'monitor' })],
      }),
    ).resolves.toEqual({ reranked: expect.any(Array) });
  });

  it('short-circuits vector search and rerank after graph errors or empty embeddings', async () => {
    const queryProducts = jest.fn().mockResolvedValue([]);

    await expect(
      vectorSearchNode(
        { errors: ['Missing graph embedder'], embedding: [0.1] },
        { configurable: { vector: { queryProducts } } },
      ),
    ).resolves.toEqual({});
    await expect(
      vectorSearchNode(
        { query: 'màn hình 144Hz', embedding: [] },
        { configurable: { vector: { queryProducts } } },
      ),
    ).resolves.toEqual({ errors: ['Missing query embedding'] });
    await expect(
      rerankNode({ errors: ['Missing graph embedder'], candidates: [candidate('p1')] }),
    ).resolves.toEqual({});

    expect(queryProducts).not.toHaveBeenCalled();
  });

  it('does not query vectors when the compiled graph cannot produce an embedding', async () => {
    const vector = { queryProducts: jest.fn().mockResolvedValue([]) };

    const result = await productRetrievalGraph.invoke(
      { query: 'màn hình 144Hz', topK: 5 },
      { configurable: { vector } },
    );

    expect(result.errors).toEqual(['Missing graph embedder']);
    expect(vector.queryProducts).not.toHaveBeenCalled();
  });
  it('compiles and invokes the smoke graph without conversation memory or customer identity', async () => {
    const embedder = {
      embedQuery: jest.fn().mockResolvedValue({ vectors: [[0.1, 0.2]] }),
    };
    const vector = {
      queryProducts: jest.fn().mockResolvedValue([
        candidate('monitor-144hz', {
          name: 'Monitor 144Hz',
          category: 'monitor',
          normalizedSpecs: { refreshRateHz: 144 },
        }),
      ]),
    };

    const result = await productRetrievalGraph.invoke(
      { query: 'màn hình 144Hz', topK: 5 },
      { configurable: { embedder, vector } },
    );

    expect(embedder.embedQuery).toHaveBeenCalled();
    expect(vector.queryProducts).toHaveBeenCalledWith([0.1, 0.2], {
      limit: 30,
      filters: expect.objectContaining({}),
    });
    expect(result.reranked[0].productId).toBe('monitor-144hz');
    expect(result).not.toHaveProperty('messages');
    expect(result).not.toHaveProperty('customerId');
  });
});

function candidate(
  productId: string,
  overrides: Partial<ProductCandidate['payload']> = {},
): ProductCandidate {
  return {
    productId,
    score: overrides.name ? 0.7 : 0.5,
    payload: {
      ...basePayload,
      ...overrides,
      productId,
      name: overrides.name ?? productId,
      slug: productId,
    },
  };
}
