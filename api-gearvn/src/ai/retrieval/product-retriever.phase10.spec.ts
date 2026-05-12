import { ProductRetriever } from './product-retriever';
import {
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
});
