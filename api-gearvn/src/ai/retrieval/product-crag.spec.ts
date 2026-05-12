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
    expect(result).toHaveProperty(
      'explanation',
      expect.stringMatching(/RTX 4090.*20 triệu|20 triệu.*RTX 4090/i),
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
});

describe('product reranker hard shopping constraints', () => {
  it('extracts approximate Vietnamese budgets as max-price constraints', () => {
    expect(
      extractHardConstraints('tầm 25 triệu, nhu cầu học AI/Machine Learning'),
    ).toMatchObject({
      maxPrice: 25_000_000,
    });
    expect(extractHardConstraints('mình có tối đa 25 triệu thôi')).toMatchObject(
      { maxPrice: 25_000_000 },
    );
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
  });

  it('applies Phase 10 intent primitive expansion and constraints for AI learning laptops', () => {
    expect(expandProductQuery('laptop học AI')).toEqual(
      expect.arrayContaining(['CUDA', 'NVIDIA', 'RTX', 'RAM 16GB', 'sinh viên IT']),
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
});

