import {
  expandProductQuery,
  extractHardConstraints,
  rerankProducts,
} from './product-reranker';
import { productRetrievalBenchmarkCases } from './product-retrieval.benchmark-cases';
import {
  clarificationRate,
  failureRate,
  meanReciprocalRank,
  ndcgAtK,
  precisionAtK,
  recallAtK,
  runProductRetrievalBenchmark,
  runProductRetrievalComparison,
} from './product-retrieval.benchmark';
import {
  expandQueryNode,
  embedQueryNode,
  productRetrievalGraph,
  rerankNode,
  vectorSearchNode,
} from './product-retrieval.graph';
import { auditBenchmarkQrels } from '../../../scripts/audit-product-retrieval-qrels';
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
            normalizedSpecs: {
              ram: '16GB',
              ssd: '512GB',
              gpu: 'NVIDIA RTX 4060',
            },
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
  it('defines exactly 80 benchmark cases with the requested group distribution', () => {
    const expectedGroups = [
      'keyword',
      'need_based',
      'gift',
      'technical',
      'combo',
      'ambiguous',
    ] as const;

    expect(productRetrievalBenchmarkCases.length).toBe(80);

    const countsByGroup = productRetrievalBenchmarkCases.reduce<
      Record<string, number>
    >((counts, benchmarkCase) => {
      counts[benchmarkCase.group] = (counts[benchmarkCase.group] ?? 0) + 1;
      return counts;
    }, {});

    expect(Object.keys(countsByGroup).sort()).toEqual(
      [...expectedGroups].sort(),
    );
    expect(countsByGroup).toEqual({
      keyword: 16,
      need_based: 16,
      gift: 12,
      technical: 16,
      combo: 12,
      ambiguous: 8,
    });
    expect(
      new Set(productRetrievalBenchmarkCases.map((item) => item.id)).size,
    ).toBe(productRetrievalBenchmarkCases.length);
    expect(
      new Set(productRetrievalBenchmarkCases.map((item) => item.query)).size,
    ).toBe(productRetrievalBenchmarkCases.length);
    expect(productRetrievalBenchmarkCases.map((item) => item.query)).toEqual(
      expect.arrayContaining([
        'laptop học AI',
        'mua quà cho bạn trai thích chơi game',
        'setup góc làm việc tại nhà',
        'laptop RTX 4060 RAM 16GB dưới 30 triệu',
        'setup gaming gồm màn hình bàn phím chuột tai nghe',
        'máy cấu hình mạnh giá tốt',
      ]),
    );
    expect(
      productRetrievalBenchmarkCases.every(
        (item) => item.expectedCategories.length > 0,
      ),
    ).toBe(true);
    expect(
      productRetrievalBenchmarkCases.every(
        (item) =>
          Boolean(item.expectedProductIds?.length) ||
          Boolean(item.expectedSpecs) ||
          Boolean(item.expectedIntents?.length) ||
          Boolean(item.expectedComboGroups?.length) ||
          typeof item.expectedClarification === 'boolean',
      ),
    ).toBe(true);

    const constrainedTechnicalQueries = new Set([
      'laptop RAM 16GB SSD 512GB GPU NVIDIA',
      'màn hình 144Hz',
      'bàn phím cơ wireless',
      'laptop dưới 25 triệu còn hàng',
      'laptop RTX 4060 RAM 16GB dưới 30 triệu',
      'laptop RAM 32GB SSD 1TB',
      'màn hình 27 inch 2K 144Hz',
      'màn hình USB-C',
      'SSD NVMe 1000GB PCIe',
      'RAM DDR5 16GB',
      'chuột wireless Logitech',
    ]);
    const technicalCases = productRetrievalBenchmarkCases.filter(
      (item) => item.group === 'technical',
    );
    expect(
      technicalCases
        .filter((item) => constrainedTechnicalQueries.has(item.query))
        .every((item) => Boolean(item.hardConstraints)),
    ).toBe(true);
  });

  it('requires binary product labels for every non-ambiguous Chapter 4 ranking case', () => {
    const rankingCases = productRetrievalBenchmarkCases.filter(
      (item) => item.expectedClarification !== true,
    );
    const unlabeledCaseIds = rankingCases
      .filter(
        (item) =>
          !Boolean(item.expectedProductIds?.length) &&
          !Boolean(item.expectedQrels?.length),
      )
      .map((item) => item.id);

    expect(rankingCases).toHaveLength(72);
    expect(unlabeledCaseIds).toEqual([]);
  });

  it('keeps expected-clarification cases out of forced product labels', () => {
    const clarificationCases = productRetrievalBenchmarkCases.filter(
      (item) => item.expectedClarification === true,
    );

    expect(clarificationCases).toHaveLength(8);
    expect(
      clarificationCases.every(
        (item) =>
          !Boolean(item.expectedProductIds?.length) &&
          !Boolean(item.expectedQrels?.length),
      ),
    ).toBe(true);
  });

  it('audits binary qrels against Mongo products and Qdrant payload IDs without leaking secrets', () => {
    const audit = auditBenchmarkQrels({
      cases: [
        {
          id: 'manual-ok',
          query: 'laptop học AI',
          group: 'need_based',
          expectedCategories: ['Laptop'],
          expectedQrels: [
            { productId: 'valid-1', relevant: true, rationale: 'manual qrel' },
          ],
        },
        {
          id: 'missing-and-duplicate',
          query: 'laptop đồ họa',
          group: 'technical',
          expectedCategories: ['Laptop'],
          expectedProductIds: ['valid-1', 'valid-1', 'missing-mongo'],
        },
        {
          id: 'clarification-with-label',
          query: 'máy cấu hình mạnh giá tốt',
          group: 'ambiguous',
          expectedCategories: ['Laptop'],
          expectedClarification: true,
          expectedProductIds: ['valid-1'],
        },
        {
          id: 'unpublished',
          query: 'màn hình 144Hz',
          group: 'technical',
          expectedCategories: ['Màn hình'],
          expectedProductIds: ['unpublished-1', 'archived-1', 'out-of-stock-1'],
        },
        {
          id: 'zero-label',
          query: 'chuột gaming',
          group: 'keyword',
          expectedCategories: ['Chuột'],
        },
      ],
      mongoProducts: [
        { _id: 'valid-1', isPublished: true, isArchived: false, stock: 5 },
        { _id: 'unpublished-1', isPublished: false, isArchived: false, stock: 2 },
        { _id: 'archived-1', isPublished: true, isArchived: true, stock: 2 },
        { _id: 'out-of-stock-1', isPublished: true, isArchived: false, stock: 0 },
      ],
      qdrantProductIds: ['valid-1', 'unpublished-1', 'archived-1'],
    });

    expect(audit.qrelsAuditReport).toBe(true);
    expect(audit.totalCases).toBe(5);
    expect(audit.nonAmbiguousCases).toBe(4);
    expect(audit.manualBinaryQrelsCases).toBe(1);
    expect(audit.expectedProductIdCases).toBe(3);
    expect(audit.expectedClarificationCases).toBe(1);
    expect(audit.missingMongoProductIds).toEqual(['missing-mongo']);
    expect(audit.missingQdrantProductIds).toEqual([
      'missing-mongo',
      'out-of-stock-1',
    ]);
    expect(audit.duplicateProductIdsByCase).toEqual({
      'missing-and-duplicate': ['valid-1'],
    });
    expect(audit.unpublishedProductIds).toEqual(['unpublished-1']);
    expect(audit.archivedProductIds).toEqual(['archived-1']);
    expect(audit.unavailableProductIds).toEqual(['out-of-stock-1']);
    expect(audit.zeroLabelRequiredCases).toEqual(['zero-label']);
    expect(audit.expectedClarificationCasesWithProductLabels).toEqual([
      'clarification-with-label',
    ]);
    expect(audit.valid).toBe(false);
    expect(audit.secretKeysLogged).toBe(false);
  });

  it('does not use category-corpus fallback for required Chapter 4 ranking cases', async () => {
    const retriever = {
      search: jest.fn().mockResolvedValue({
        results: [
          candidate('labelled-product', {
            category: 'laptop',
            categoryPath: ['Laptop'],
          }),
        ].map((item) => ({ ...item, rerankScore: 7, reasons: [] })),
      }),
    };
    const rankingCases = productRetrievalBenchmarkCases.filter(
      (item) => item.expectedClarification !== true,
    );

    const report = await runProductRetrievalBenchmark(
      retriever as unknown as ProductRetriever,
      rankingCases,
    );

    expect(
      new Set(report.results.map((result) => result.labelSource)),
    ).not.toContain('category_corpus');
  });
  it('computes Recall@10, Precision@5, MRR, nDCG@10, Failure Rate, and Clarification Rate deterministically', () => {
    const ranked = ['p1', 'p2', 'p3', 'p4', 'p5'];
    const relevant = new Set(['p2', 'p4']);

    expect(recallAtK(ranked, relevant, 10)).toBe(1);
    expect(precisionAtK(ranked, relevant, 5)).toBe(0.4);
    expect(meanReciprocalRank([ranked], [relevant])).toBe(0.5);
    expect(ndcgAtK(ranked, relevant, 10)).toBeCloseTo(0.6509, 4);
    expect(
      failureRate([{ relevantFound: true }, { relevantFound: false }]),
    ).toBe(0.5);
    expect(clarificationRate([{ clarified: true }, { clarified: false }])).toBe(
      0.5,
    );
  });

  it('uses binary gain for nDCG@10 so all relevant products contribute equally', () => {
    const ranked = [
      'lower-confidence-relevant',
      'irrelevant',
      'manual-qrel-relevant',
    ];
    const relevant = new Set([
      'manual-qrel-relevant',
      'lower-confidence-relevant',
    ]);

    expect(ndcgAtK(ranked, relevant, 10)).toBeCloseTo(0.9197, 4);
  });

  it('prioritizes manual binary qrels, product IDs, and expected clarification label sources', async () => {
    const retriever = {
      search: jest.fn().mockImplementation(async (query: string) => {
        if (query === 'máy mạnh giá tốt') {
          return {
            clarification: { needed: true, reason: 'missing_budget' },
            results: [],
          };
        }

        return {
          results: [
            candidate('manual-relevant', {
              category: 'laptop',
              categoryPath: ['Laptop'],
            }),
            candidate('category-only', {
              category: 'laptop',
              categoryPath: ['Laptop'],
            }),
            candidate('expected-id', {
              category: 'monitor',
              categoryPath: ['Monitor'],
            }),
          ].map((item) => ({ ...item, rerankScore: 7, reasons: [] })),
        };
      }),
    };

    const report = await runProductRetrievalBenchmark(
      retriever as unknown as ProductRetriever,
      [
        {
          id: 'manual-qrels',
          query: 'laptop học AI',
          group: 'need_based',
          expectedCategories: ['laptop'],
          expectedQrels: [
            {
              productId: 'manual-relevant',
              relevant: true,
              rationale:
                'Catalog item was manually judged relevant to AI laptop intent.',
            },
          ],
        },
        {
          id: 'expected-products',
          query: 'màn hình Dell',
          group: 'keyword',
          expectedCategories: ['monitor'],
          expectedProductIds: ['expected-id'],
        },
        {
          id: 'clarification',
          query: 'máy mạnh giá tốt',
          group: 'ambiguous',
          expectedCategories: ['laptop'],
          expectedClarification: true,
        },
      ],
      {
        relevanceCorpus: [
          candidate('manual-relevant', {
            category: 'laptop',
            categoryPath: ['Laptop'],
          }).payload,
          candidate('category-only', {
            category: 'laptop',
            categoryPath: ['Laptop'],
          }).payload,
          candidate('expected-id', {
            category: 'monitor',
            categoryPath: ['Monitor'],
          }).payload,
        ],
      },
    );

    expect(report.results[0]).toEqual(
      expect.objectContaining({
        labelSource: 'manual_binary_qrels',
        relevantSetSize: 1,
        topKRelevantHits: 1,
        metrics: expect.objectContaining({
          'Recall@10': 1,
          'Precision@5': 0.2,
          MRR: 1,
        }),
      }),
    );
    expect(report.results[1]).toEqual(
      expect.objectContaining({
        labelSource: 'expected_product_ids',
        relevantSetSize: 1,
        topKRelevantHits: 1,
        metrics: expect.objectContaining({ MRR: 0.3333 }),
      }),
    );
    expect(report.results[2]).toEqual(
      expect.objectContaining({
        labelSource: 'expected_clarification',
        relevantSetSize: 0,
        relevantFound: true,
        clarified: true,
      }),
    );
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
        labelSource: 'expected_product_ids',
        relevantSetSize: 1,
        topKRelevantHits: 1,
        topK: [expect.objectContaining({ productId: 'ai-laptop', score: 7 })],
        metrics: expect.objectContaining({ 'Recall@10': 1 }),
      }),
    );
  });

  it('passes bounded rewrite context to the improved benchmark pipeline', async () => {
    const retriever = {
      search: jest.fn().mockResolvedValue({
        results: [
          candidate('ai-laptop', {
            name: 'RTX Laptop AI',
            category: 'laptop',
            categoryPath: ['Laptop'],
          }),
        ].map((item) => ({ ...item, rerankScore: 7, reasons: [] })),
        rewrite: {
          metadata: {
            rewrite_provider: 'deepseek',
            rewrite_model: 'deepseek-custom',
            rewrite_status: 'success',
            rewrite_retry_count: 0,
            rewrite_latency_ms: 123,
            rewritten_query: 'laptop học AI dưới 30 triệu',
          },
        },
      }),
    };

    const report = await runProductRetrievalBenchmark(
      retriever as unknown as ProductRetriever,
      [
        {
          id: 'case-1',
          query: 'laptop học AI dưới 30 triệu',
          group: 'need_based',
          expectedCategories: ['laptop'],
          expectedProductIds: ['ai-laptop'],
          hardConstraints: { maxPrice: 30_000_000, categoryHints: ['laptop'] },
        },
      ],
      {
        pipeline: 'phase-10-improved',
        rewriteTimeoutMs: 10_000,
        allowDeterministicShortCircuit: true,
      },
    );

    expect(retriever.search).toHaveBeenCalledWith(
      'laptop học AI dưới 30 triệu',
      expect.objectContaining({
        pipeline: 'phase-10-improved',
        rewriteContext: expect.objectContaining({
          query: 'laptop học AI dưới 30 triệu',
          originalQuery: 'laptop học AI dưới 30 triệu',
          hardConstraints: { maxPrice: 30_000_000, categoryHints: ['laptop'] },
          timeoutMs: 10_000,
          allowDeterministicShortCircuit: true,
        }),
      }),
    );
    expect(report.results[0].rewrite).toEqual({
      rewriteProvider: 'deepseek',
      rewriteModel: 'deepseek-custom',
      rewriteStatus: 'success',
      rewriteRetryCount: 0,
      rewriteLatencyMs: 123,
      rewrittenQuery: 'laptop học AI dưới 30 triệu',
    });
  });

  it('records per-case retrieval errors without aborting the report', async () => {
    const retriever = {
      search: jest
        .fn()
        .mockResolvedValueOnce({
          results: [
            candidate('ai-laptop', {
              name: 'RTX Laptop AI',
              category: 'laptop',
              categoryPath: ['Laptop'],
            }),
          ].map((item) => ({ ...item, rerankScore: 7, reasons: [] })),
        })
        .mockRejectedValueOnce(
          new Error('Bad Request apiKey=secret-value Bearer token-value'),
        ),
    };

    const report = await runProductRetrievalBenchmark(
      retriever as unknown as ProductRetriever,
      [
        {
          id: 'case-ok',
          query: 'laptop học AI',
          group: 'need_based',
          expectedCategories: ['laptop'],
          expectedProductIds: ['ai-laptop'],
        },
        {
          id: 'case-error',
          query: 'setup livestream',
          group: 'combo',
          expectedCategories: ['pc', 'monitor'],
        },
      ],
    );

    expect(report.results.map((result) => result.caseId)).toEqual([
      'case-ok',
      'case-error',
    ]);
    expect(report.results[1]).toEqual(
      expect.objectContaining({
        labelSource: 'category_corpus',
        relevantSetSize: 0,
        topKRelevantHits: 0,
        topK: [],
        metrics: {
          'Recall@10': 0,
          'Precision@5': 0,
          MRR: 0,
          'nDCG@10': 0,
        },
        relevantFound: false,
        clarified: false,
        groupCoverage: 0,
        failureReason:
          'Retrieval failed: Bad Request apiKey=[redacted] Bearer [redacted]',
      }),
    );
    expect(report.summary['Failure Rate']).toBe(0.5);
  });

  it('keeps expected-clarification retrieval errors out of ranking summary metrics', async () => {
    const retriever = {
      search: jest
        .fn()
        .mockResolvedValueOnce({
          results: [
            candidate('ai-laptop', {
              name: 'RTX Laptop AI',
              category: 'laptop',
              categoryPath: ['Laptop'],
            }),
          ].map((item) => ({ ...item, rerankScore: 7, reasons: [] })),
        })
        .mockRejectedValueOnce(new Error('temporary vector failure')),
    };

    const report = await runProductRetrievalBenchmark(
      retriever as unknown as ProductRetriever,
      [
        {
          id: 'case-ranked',
          query: 'laptop học AI',
          group: 'need_based',
          expectedCategories: ['laptop'],
          expectedProductIds: ['ai-laptop'],
        },
        {
          id: 'case-clarify-error',
          query: 'máy mạnh giá tốt',
          group: 'ambiguous',
          expectedCategories: ['laptop'],
          expectedClarification: true,
        },
      ],
    );

    expect(report.summary.MRR).toBe(1);
    expect(report.summary['Recall@10']).toBe(1);
    expect(report.summary['nDCG@10']).toBe(1);
    expect(report.summary['Failure Rate']).toBe(0.5);
    expect(report.results[1]).toEqual(
      expect.objectContaining({
        labelSource: 'expected_clarification',
        failureReason: 'Retrieval failed: temporary vector failure',
      }),
    );
  });
  it('preserves strict per-case retrieval errors when continueOnError is false', async () => {
    const retriever = {
      search: jest.fn().mockRejectedValue(new Error('strict failure')),
    };

    await expect(
      runProductRetrievalBenchmark(
        retriever as unknown as ProductRetriever,
        [
          {
            id: 'case-error',
            query: 'setup livestream',
            group: 'combo',
            expectedCategories: ['pc', 'monitor'],
          },
        ],
        { continueOnError: false },
      ),
    ).rejects.toThrow('strict failure');
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
          candidate('ai-laptop', {
            category: 'laptop',
            categoryPath: ['Laptop'],
          }).payload,
          candidate('other-laptop', {
            category: 'laptop',
            categoryPath: ['Laptop'],
          }).payload,
          candidate('monitor', {
            category: 'monitor',
            categoryPath: ['Monitor'],
          }).payload,
        ],
      },
    );

    expect(report.results[0]).toEqual(
      expect.objectContaining({
        labelSource: 'category_corpus',
        relevantSetSize: 2,
        topKRelevantHits: 1,
        metrics: expect.objectContaining({
          'Recall@10': 0.5,
          'Precision@5': 0.2,
          MRR: 1,
        }),
      }),
    );
  });

  it('counts expected clarification success without depressing ranking summary metrics', async () => {
    const retriever = {
      search: jest.fn().mockImplementation(async (query: string) => {
        if (query === 'laptop nào tốt') {
          return {
            clarification: { needed: true, reason: 'missing_budget' },
            results: [],
          };
        }
        return {
          clarification: { needed: false, reason: null },
          results: [
            candidate('ai-laptop', {
              name: 'RTX Laptop AI',
              category: 'laptop',
              categoryPath: ['Laptop'],
            }),
          ].map((item) => ({ ...item, rerankScore: 7, reasons: [] })),
        };
      }),
    };

    const report = await runProductRetrievalBenchmark(
      retriever as unknown as ProductRetriever,
      [
        {
          id: 'case-clarify',
          query: 'laptop nào tốt',
          group: 'ambiguous',
          expectedCategories: ['laptop'],
          expectedClarification: true,
        },
        {
          id: 'case-ranked',
          query: 'laptop học AI',
          group: 'need_based',
          expectedCategories: ['laptop'],
          expectedProductIds: ['ai-laptop'],
        },
      ],
    );

    expect(report.summary['Failure Rate']).toBe(0);
    expect(report.summary['Clarification Rate']).toBe(0.5);
    expect(report.summary['Recall@10']).toBe(1);
    expect(report.summary.MRR).toBe(1);
    expect(report.results[0]).toEqual(
      expect.objectContaining({
        relevantFound: true,
        clarified: true,
        topK: [],
        metrics: {
          'Recall@10': 0,
          'Precision@5': 0,
          MRR: 0,
          'nDCG@10': 0,
        },
      }),
    );
    expect(report.results[0]).not.toHaveProperty('failureReason');
  });

  it('uses family identity to count broad accessory products without matching unrelated accessories', async () => {
    const retriever = {
      search: jest.fn().mockResolvedValue({
        results: [
          candidate('webcam', {
            name: 'Logitech Brio Webcam 4K',
            category: 'Phụ kiện',
            categoryPath: ['Phụ kiện'],
            semanticTags: ['webcam livestream'],
          }),
        ].map((item) => ({ ...item, rerankScore: 7, reasons: [] })),
      }),
    };

    const report = await runProductRetrievalBenchmark(
      retriever as unknown as ProductRetriever,
      [
        {
          id: 'home-office',
          query: 'setup góc làm việc tại nhà',
          group: 'need_based',
          expectedCategories: ['monitor', 'keyboard', 'mouse', 'webcam'],
        },
      ],
      {
        relevanceCorpus: [
          candidate('webcam', {
            name: 'Logitech Brio Webcam 4K',
            category: 'Phụ kiện',
            categoryPath: ['Phụ kiện'],
            semanticTags: ['webcam livestream'],
          }).payload,
          candidate('screen-protector', {
            name: 'Miếng dán màn hình iPhone',
            category: 'Phụ kiện',
            categoryPath: ['Phụ kiện'],
            semanticTags: ['screen protector'],
          }).payload,
          candidate('camera-accessory', {
            name: 'Camera tripod adapter',
            category: 'Phụ kiện',
            categoryPath: ['Phụ kiện'],
            semanticTags: ['camera accessory'],
          }).payload,
        ],
      },
    );

    expect(report.results[0]).toEqual(
      expect.objectContaining({
        relevantFound: true,
        metrics: expect.objectContaining({
          'Recall@10': 1,
          MRR: 1,
        }),
      }),
    );
  });

  it('reports missing clarification only when expected clarification is not produced', async () => {
    const retriever = {
      search: jest.fn().mockResolvedValue({
        clarification: { needed: false, reason: null },
        results: [],
      }),
    };

    const report = await runProductRetrievalComparison(
      retriever as unknown as ProductRetriever,
      [
        {
          id: 'case-clarify',
          query: 'laptop nào tốt',
          group: 'ambiguous',
          expectedCategories: ['laptop'],
          expectedClarification: true,
        },
      ],
      { rewriteModel: 'deepseek-custom' },
    );

    expect(report.rewriteModel).toBe('deepseek-custom');
    expect(report.failures).toEqual([
      {
        caseId: 'case-clarify',
        pipeline: 'phase-09.2-baseline',
        reason: 'Expected clarification was not produced',
      },
      {
        caseId: 'case-clarify',
        pipeline: 'phase-10-improved',
        reason: 'Expected clarification was not produced',
      },
    ]);
  });

  it('compares baseline and improved pipelines with identical case IDs and relative gate metadata', async () => {
    const calls: Array<{ query: string; pipeline: string }> = [];
    const retriever = {
      search: jest.fn().mockImplementation(async (query: string, options) => {
        calls.push({ query, pipeline: options.pipeline });
        const productId =
          options.pipeline === 'phase-10-improved' ? 'ai-laptop' : 'other';
        return {
          clarification:
            options.pipeline === 'phase-10-improved'
              ? { needed: false, reason: null }
              : undefined,
          groupCoverage:
            options.pipeline === 'phase-10-improved'
              ? {
                  expectedGroups: ['laptop'],
                  coveredGroups: ['laptop'],
                  missingGroups: [],
                  coverageRate: 1,
                }
              : undefined,
          results: [
            candidate(productId, {
              name: productId,
              category: productId === 'ai-laptop' ? 'laptop' : 'monitor',
              categoryPath: [productId === 'ai-laptop' ? 'Laptop' : 'Monitor'],
            }),
          ].map((item) => ({ ...item, rerankScore: 7, reasons: [] })),
        };
      }),
    };
    const cases = [
      {
        id: 'case-1',
        query: 'laptop học AI',
        group: 'need_based' as const,
        expectedCategories: ['laptop'],
        expectedProductIds: ['ai-laptop'],
      },
    ];

    const report = await runProductRetrievalComparison(
      retriever as unknown as ProductRetriever,
      cases,
      { rewriteModel: 'deepseek-custom' },
    );

    expect(calls.map((call) => call.pipeline)).toEqual([
      'phase-09.2-baseline',
      'phase-10-improved',
    ]);
    expect(report.baseline.results.map((result) => result.caseId)).toEqual(
      report.improved.results.map((result) => result.caseId),
    );
    expect(report).toEqual(
      expect.objectContaining({
        baselineVersion: 'phase-09.2',
        improvedVersion: 'phase-10',
        rewriteModel: 'deepseek-custom',
        secretKeysLogged: false,
        relativeGate: expect.objectContaining({ passed: true }),
        qrelsCoverage: {
          totalCases: 1,
          manual_binary_qrels: 0,
          expected_product_ids: 1,
          expected_clarification: 0,
          category_corpus: 0,
          nonAmbiguousUnlabeled: 0,
        },
      }),
    );
    expect(report.improved.summary).toEqual(
      expect.objectContaining({
        'Clarification Rate': 0,
        'Group Coverage': 1,
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
      rerankNode({
        errors: ['Missing graph embedder'],
        candidates: [candidate('p1')],
      }),
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
