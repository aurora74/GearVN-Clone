import { ProductRetriever } from './product-retriever';
import {
  ProductRetrievalAblationVariant,
  ProductRetrievalPipelineMode,
  ProductRetrievalResult,
} from './product-retrieval.types';

describe('ProductRetriever Phase 10 contracts', () => {
  const payload = {
    productId: 'p1',
    name: 'Laptop AI',
    slug: 'laptop-ai',
    category: 'Laptop',
    categoryPath: ['Laptop'],
    price: 20_000_000,
    discountPrice: 19_000_000,
    stock: 5,
    isPublished: true,
    isArchived: false,
    semanticTags: ['ai'],
    useCases: ['hoc ai'],
    targetUsers: ['student'],
  };

  it('exposes baseline and improved pipeline mode literals', () => {
    const modes: ProductRetrievalPipelineMode[] = [
      'phase-09.2-baseline',
      'phase-10-improved',
    ];

    expect(modes).toEqual(['phase-09.2-baseline', 'phase-10-improved']);
  });

  it('exposes benchmark-only ablation variant literals', () => {
    const variants: ProductRetrievalAblationVariant[] = [
      'dense_vector_only',
      'hybrid_no_rerank',
      'hybrid_rerank_no_expansion',
      'hybrid_rerank_expansion',
      'hybrid_rerank_rewrite',
      'phase_10_full',
    ];

    expect(variants).toEqual([
      'dense_vector_only',
      'hybrid_no_rerank',
      'hybrid_rerank_no_expansion',
      'hybrid_rerank_expansion',
      'hybrid_rerank_rewrite',
      'phase_10_full',
    ]);
  });

  it('allows retrieval results to carry rewrite, clarification, combo, and group coverage metadata', () => {
    const result: ProductRetrievalResult = {
      pipelineVersion: 'phase-10-improved',
      query: {
        original: 'setup lam viec tai nha',
        expanded: ['work from home'],
        expandedText: 'setup lam viec tai nha | work from home',
        constraints: {},
      },
      candidates: [],
      results: [],
      rewrite: {
        rewrittenQuery: 'man hinh ban phim chuot webcam lam viec tai nha',
        detectedIntents: ['WORK_FROM_HOME'],
        productGroups: ['monitor', 'keyboard', 'mouse', 'webcam'],
        hardConstraints: {},
        softSignals: ['ergonomic'],
        expandedKeywords: ['work from home'],
        comboGroups: ['monitor', 'keyboard', 'mouse', 'webcam'],
        metadata: {
          rewrite_provider: 'deepseek',
          rewrite_model: 'deepseek-v4-pro',
          rewrite_status: 'success',
          rewrite_retry_count: 0,
          rewrite_latency_ms: 42,
          rewritten_query: 'man hinh ban phim chuot webcam lam viec tai nha',
        },
      },
      clarification: {
        needed: false,
        reason: null,
      },
      comboGroups: [
        {
          id: 'monitor',
          label: 'Monitor',
          query: 'man hinh lam viec tai nha',
          results: [],
        },
      ],
      groupCoverage: {
        expectedGroups: ['monitor', 'keyboard', 'mouse', 'webcam'],
        coveredGroups: ['monitor'],
        missingGroups: ['keyboard', 'mouse', 'webcam'],
        coverageRate: 0.25,
      },
    };

    expect(result.pipelineVersion).toBe('phase-10-improved');
    expect(result.groupCoverage?.missingGroups).toContain('keyboard');
  });

  it('can instantiate the baseline retriever without a rewrite service', async () => {
    const retriever = new ProductRetriever(
      { embedQuery: jest.fn().mockResolvedValue([0.1, 0.2]) },
      {
        queryProducts: jest.fn().mockResolvedValue([
          {
            productId: 'p1',
            score: 0.9,
            payload,
          },
        ]),
      },
      { search: jest.fn().mockResolvedValue([]) },
    );

    const result = await retriever.search('laptop hoc ai', { topK: 1 });

    expect(result.results.length).toBeGreaterThanOrEqual(1);
    expect(result.query.original).toBe('laptop hoc ai');
  });

  it('does not call rewrite service for baseline search', async () => {
    const rewriteService = { rewrite: jest.fn() };
    const retriever = new ProductRetriever(
      { embedQuery: jest.fn().mockResolvedValue([0.1, 0.2]) },
      {
        queryProducts: jest.fn().mockResolvedValue([
          {
            productId: 'p1',
            score: 0.9,
            payload,
          },
        ]),
      },
      { search: jest.fn().mockResolvedValue([]) },
      rewriteService,
    );

    await retriever.search('laptop hoc ai', { topK: 1 });

    expect(rewriteService.rewrite).not.toHaveBeenCalled();
  });

  it('runs dense vector-only ablation without lexical search, rerank, or local expansion', async () => {
    const embedder = { embedQuery: jest.fn().mockResolvedValue([0.1, 0.2]) };
    const vector = {
      queryProducts: jest.fn().mockResolvedValue([
        {
          productId: 'lower-score-first',
          score: 0.1,
          payload: { ...payload, productId: 'lower-score-first' },
        },
        {
          productId: 'higher-score-second',
          score: 0.9,
          payload: { ...payload, productId: 'higher-score-second' },
        },
      ]),
    };
    const lexical = { search: jest.fn() };
    const retriever = new ProductRetriever(embedder, vector, lexical);

    const result = await retriever.search('laptop học AI', {
      topK: 1,
      ablationVariant: 'dense_vector_only',
    });

    expect(embedder.embedQuery).toHaveBeenCalledWith('laptop học AI');
    expect(lexical.search).not.toHaveBeenCalled();
    expect(result.lexicalCandidates).toEqual([]);
    expect(result.results.map((item) => item.productId)).toEqual([
      'lower-score-first',
    ]);
    expect(result.results[0]?.reasons).toEqual([
      expect.objectContaining({ code: 'vector_score' }),
    ]);
  });

  it('runs hybrid no-rerank ablation in raw vector then lexical source order', async () => {
    const retriever = new ProductRetriever(
      { embedQuery: jest.fn().mockResolvedValue([0.1, 0.2]) },
      {
        queryProducts: jest.fn().mockResolvedValue([
          {
            productId: 'vector-product',
            score: 0.2,
            payload: { ...payload, productId: 'vector-product' },
          },
        ]),
      },
      {
        search: jest.fn().mockResolvedValue([
          {
            productId: 'lexical-product',
            score: 0.99,
            lexicalScore: 0.99,
            payload: { ...payload, productId: 'lexical-product' },
          },
        ]),
      },
    );

    const result = await retriever.search('laptop học AI', {
      topK: 2,
      ablationVariant: 'hybrid_no_rerank',
    });

    expect(result.results.map((item) => item.productId)).toEqual([
      'vector-product',
      'lexical-product',
    ]);
    expect(result.results[1]?.reasons).toEqual([
      expect.objectContaining({ code: 'bm25_score' }),
    ]);
  });

  it('disables combo fan-out for hybrid rewrite ablation while preserving full Phase 10 behavior', async () => {
    const comboService = {
      searchCombo: jest.fn().mockResolvedValue({
        groups: [
          {
            id: 'monitor',
            label: 'Monitor',
            query: 'monitor setup',
            results: [],
          },
        ],
        groupCoverage: {
          expectedGroups: ['monitor'],
          coveredGroups: [],
          missingGroups: ['monitor'],
          coverageRate: 0,
        },
      }),
    };
    const rewriteService = {
      rewrite: jest.fn().mockResolvedValue(
        buildRewrite({
          rewrittenQuery: 'setup gaming monitor keyboard',
          comboGroups: ['monitor', 'keyboard'],
        }),
      ),
    };
    const retriever = new ProductRetriever(
      { embedQuery: jest.fn().mockResolvedValue([0.3, 0.4]) },
      {
        queryProducts: jest.fn().mockResolvedValue([
          {
            productId: 'p1',
            score: 0.95,
            payload: {
              ...payload,
              name: 'Setup gaming monitor keyboard',
              category: 'monitor',
              categoryPath: ['Monitor'],
              semanticTags: ['gaming', 'monitor', 'keyboard'],
            },
          },
        ]),
      },
      { search: jest.fn().mockResolvedValue([]) },
      rewriteService,
      comboService,
    );

    const rewriteOnly = await retriever.search('setup gaming', {
      topK: 1,
      rewriteContext: { query: 'setup gaming', originalQuery: 'setup gaming' },
      ablationVariant: 'hybrid_rerank_rewrite',
    });

    expect(comboService.searchCombo).not.toHaveBeenCalled();
    expect(rewriteOnly.rewrite?.comboGroups).toEqual([]);
    expect(rewriteOnly.results).toHaveLength(1);

    await retriever.search('setup gaming', {
      topK: 1,
      rewriteContext: { query: 'setup gaming', originalQuery: 'setup gaming' },
      ablationVariant: 'phase_10_full',
    });

    expect(comboService.searchCombo).toHaveBeenCalled();
  });

  it('calls rewrite service before improved hybrid vector and lexical search', async () => {
    const embedder = { embedQuery: jest.fn().mockResolvedValue([0.3, 0.4]) };
    const vector = {
      queryProducts: jest.fn().mockResolvedValue([
        {
          productId: 'p1',
          score: 0.95,
          payload: {
            ...payload,
            name: 'Laptop RTX AI CUDA',
            normalizedSpecs: { ram: '16GB', ssd: '512GB', gpu: 'NVIDIA RTX' },
          },
        },
      ]),
    };
    const lexical = { search: jest.fn().mockResolvedValue([]) };
    const rewriteService = {
      rewrite: jest.fn().mockResolvedValue(
        buildRewrite({
          rewrittenQuery: 'laptop RTX AI CUDA RAM 16GB SSD 512GB',
          expandedKeywords: ['CUDA', 'NVIDIA', 'machine learning'],
          hardConstraints: {
            categoryHints: ['laptop'],
            requiredSpecs: { ramGb: 16, ssdGb: 512, gpu: 'nvidia' },
          },
        }),
      ),
    };
    const retriever = new ProductRetriever(
      embedder,
      vector,
      lexical,
      rewriteService,
    );

    const result = await retriever.search('laptop hoc ai', {
      topK: 1,
      pipeline: 'phase-10-improved',
    });

    expect(rewriteService.rewrite).toHaveBeenCalledWith({
      query: 'laptop hoc ai',
      hardConstraints: {},
    });
    expect(embedder.embedQuery).toHaveBeenCalledWith(
      expect.stringContaining('laptop RTX AI CUDA RAM 16GB SSD 512GB'),
    );
    expect(embedder.embedQuery).toHaveBeenCalledWith(
      expect.stringContaining('CUDA'),
    );
    expect(vector.queryProducts).toHaveBeenCalled();
    expect(lexical.search).toHaveBeenCalledWith(
      'laptop RTX AI CUDA RAM 16GB SSD 512GB',
      expect.any(Object),
    );
    expect(result.pipelineVersion).toBe('phase-10-improved');
    expect(result.rewrite?.rewrittenQuery).toContain('RTX AI');
    expect(result.results[0]?.reasons.length).toBeGreaterThan(0);
  });

  it('returns clarification without vector query when improved rewrite asks for clarification', async () => {
    const embedder = { embedQuery: jest.fn() };
    const vector = { queryProducts: jest.fn() };
    const rewriteService = {
      rewrite: jest.fn().mockResolvedValue(
        buildRewrite({
          rewrittenQuery: 'may manh gia tot',
          clarificationNeeded: true,
          clarificationReason: 'Missing product group and budget',
        }),
      ),
    };
    const retriever = new ProductRetriever(
      embedder,
      vector,
      undefined,
      rewriteService,
    );

    const result = await retriever.search('máy mạnh giá tốt', {
      pipeline: 'phase-10-improved',
    });

    expect(result.pipelineVersion).toBe('phase-10-improved');
    expect(result.clarification?.needed).toBe(true);
    expect(result.results).toEqual([]);
    expect(embedder.embedQuery).not.toHaveBeenCalled();
    expect(vector.queryProducts).not.toHaveBeenCalled();
  });

  it('short-circuits vector search when fallback rewrite produces clarification', async () => {
    const embedder = { embedQuery: jest.fn() };
    const vector = { queryProducts: jest.fn() };
    const lexical = { search: jest.fn() };
    const rewriteService = {
      rewrite: jest.fn().mockResolvedValue(
        buildRewrite({
          rewrittenQuery: 'máy mạnh giá tốt',
          clarificationNeeded: true,
          clarificationReason: 'Needs product type, budget, and use case before retrieval.',
          metadata: {
            rewrite_provider: 'deepseek',
            rewrite_model: 'deepseek-v4-pro',
            rewrite_status: 'fallback_timeout',
            rewrite_retry_count: 0,
            rewrite_latency_ms: 5,
            rewritten_query: 'máy mạnh giá tốt',
          },
        }),
      ),
    };
    const retriever = new ProductRetriever(
      embedder,
      vector,
      lexical,
      rewriteService,
    );

    const result = await retriever.search('máy mạnh giá tốt', {
      pipeline: 'phase-10-improved',
      rewriteContext: { query: 'máy mạnh giá tốt', timeoutMs: 5 },
    });

    expect(result.clarification?.needed).toBe(true);
    expect(result.rewrite?.metadata.rewrite_status).toBe('fallback_timeout');
    expect(result.results).toEqual([]);
    expect(embedder.embedQuery).not.toHaveBeenCalled();
    expect(vector.queryProducts).not.toHaveBeenCalled();
    expect(lexical.search).not.toHaveBeenCalled();
  });
  it('does not enter combo retrieval for single-category AI/ML laptop advice', async () => {
    const embedder = { embedQuery: jest.fn().mockResolvedValue([0.3, 0.4]) };
    const vector = {
      queryProducts: jest.fn().mockResolvedValue([
        {
          productId: 'p1',
          score: 0.95,
          payload,
        },
      ]),
    };
    const lexical = { search: jest.fn().mockResolvedValue([]) };
    const comboService = { searchCombo: jest.fn() };
    const rewriteService = {
      rewrite: jest.fn().mockResolvedValue(
        buildRewrite({
          rewrittenQuery: 'laptop RTX AI CUDA dưới 30 triệu',
          comboGroups: ['laptop', 'storage'],
          hardConstraints: { categoryHints: ['laptop'], maxPrice: 30_000_000 },
        }),
      ),
    };
    const retriever = new ProductRetriever(
      embedder,
      vector,
      lexical,
      rewriteService,
      comboService,
    );

    const result = await retriever.search('laptop 30 triệu học Machine Learning', {
      topK: 1,
      pipeline: 'phase-10-improved',
      rewriteContext: {
        query: 'laptop 30 triệu học Machine Learning',
        originalQuery: '30 triệu đổ xuống để học Machine Learning',
        clarificationAnswer: 'tư vấn laptop 30 triệu học Machine Learning',
      },
    });

    expect(comboService.searchCombo).not.toHaveBeenCalled();
    expect(vector.queryProducts).toHaveBeenCalled();
    expect(result.comboGroups).toBeUndefined();
    expect(result.rewrite?.comboGroups).toEqual([]);
    expect(result.results[0]?.productId).toBe('p1');
  });
  it('delegates combo rewrite groups to combo retrieval and flattens grouped results', async () => {
    const groupedProduct = {
      productId: 'monitor-1',
      score: 0.8,
      rerankScore: 4,
      reasons: [],
      payload,
    };
    const comboService = {
      searchCombo: jest.fn().mockResolvedValue({
        groups: [
          {
            id: 'monitor',
            label: 'Monitor',
            query: 'monitor setup',
            results: [groupedProduct],
          },
        ],
        groupCoverage: {
          expectedGroups: ['monitor', 'keyboard'],
          coveredGroups: ['monitor'],
          missingGroups: ['keyboard'],
          coverageRate: 0.5,
        },
      }),
    };
    const rewriteService = {
      rewrite: jest.fn().mockResolvedValue(
        buildRewrite({
          rewrittenQuery: 'setup lam viec tai nha',
          comboGroups: ['monitor', 'keyboard'],
          hardConstraints: {
            maxPrice: 5_000_000,
            inStockOnly: true,
            requiredSpecs: { refreshRateHz: 144 },
          },
        }),
      ),
    };
    const retriever = new ProductRetriever(
      { embedQuery: jest.fn() },
      { queryProducts: jest.fn() },
      undefined,
      rewriteService,
      comboService,
    );

    const result = await retriever.search('setup làm việc tại nhà', {
      topK: 3,
      pipeline: 'phase-10-improved',
      constraints: {
        categoryHints: ['phu kien'],
        requiredSpecs: { wireless: true },
      },
    });

    expect(comboService.searchCombo).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'setup lam viec tai nha',
        groups: ['monitor', 'keyboard'],
        constraints: expect.objectContaining({
          maxPrice: 5_000_000,
          inStockOnly: true,
          categoryHints: ['phu kien'],
          requiredSpecs: { wireless: true, refreshRateHz: 144 },
        }),
        retriever,
        perGroupTopK: 3,
      }),
    );
    expect(result.comboGroups).toHaveLength(1);
    expect(result.groupCoverage?.coverageRate).toBe(0.5);
    expect(result.results).toEqual([groupedProduct]);
  });
});

function buildRewrite(overrides: Record<string, unknown> = {}) {
  return {
    rewrittenQuery: 'laptop hoc ai',
    detectedIntents: ['AI_ML_LEARNING'],
    productGroups: ['laptop'],
    hardConstraints: {},
    softSignals: [],
    expandedKeywords: [],
    comboGroups: [],
    clarificationNeeded: false,
    clarificationReason: null,
    confidence: 0.9,
    metadata: {
      rewrite_provider: 'deepseek',
      rewrite_model: 'deepseek-v4-pro',
      rewrite_status: 'success',
      rewrite_retry_count: 0,
      rewrite_latency_ms: 10,
      rewritten_query: overrides.rewrittenQuery ?? 'laptop hoc ai',
    },
    ...overrides,
  };
}
