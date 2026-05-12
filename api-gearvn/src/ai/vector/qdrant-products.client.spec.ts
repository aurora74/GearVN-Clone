import {
  ProductVectorPoint,
  QdrantProductsClient,
} from './qdrant-products.client';

const config = {
  openRouter: {
    apiKeyPresent: false,
    embeddingModel: 'baai/bge-m3',
  },
  qdrant: {
    url: 'https://qdrant.example',
    apiKey: 'test-qdrant-key',
    apiKeyPresent: true,
    collection: 'products',
  },
};

const payload = {
  productId: 'product-1',
  name: 'Laptop Gaming Alpha',
  slug: 'laptop-gaming-alpha',
  category: 'laptop',
  categoryPath: ['Laptop', 'Laptop Gaming'],
  price: 25000000,
  discountPrice: 23000000,
  stock: 4,
  isPublished: true,
  isArchived: false,
  semanticTags: ['gaming'],
  useCases: ['choi game'],
  targetUsers: ['sinh vien'],
};

describe('QdrantProductsClient', () => {
  it('creates the products collection with Cosine vectors and targeted payload indexes', async () => {
    const qdrant = mockQdrantClient();
    qdrant.getCollection.mockRejectedValueOnce({ status: 404 });
    const client = new QdrantProductsClient({ config, qdrant });

    await client.ensureCollection(1024);

    expect(qdrant.createCollection).toHaveBeenCalledWith('products', {
      vectors: { size: 1024, distance: 'Cosine' },
    });
    expect(qdrant.createPayloadIndex).toHaveBeenCalledTimes(7);
    expect(qdrant.createPayloadIndex).toHaveBeenCalledWith('products', {
      field_name: 'productId',
      field_schema: 'keyword',
      wait: true,
    });
    expect(qdrant.createPayloadIndex).toHaveBeenCalledWith('products', {
      field_name: 'isArchived',
      field_schema: 'bool',
      wait: true,
    });
  });

  it('recreates the products collection for rebuild indexing runs', async () => {
    const qdrant = mockQdrantClient();
    const client = new QdrantProductsClient({ config, qdrant });

    await client.recreateCollection(1024);

    expect(qdrant.recreateCollection).toHaveBeenCalledWith('products', {
      vectors: { size: 1024, distance: 'Cosine' },
    });
    expect(qdrant.createPayloadIndex).toHaveBeenCalledWith('products', {
      field_name: 'productId',
      field_schema: 'keyword',
      wait: true,
    });
  });

  it('accepts an existing collection with the expected vector size and Cosine distance', async () => {
    const qdrant = mockQdrantClient();
    qdrant.getCollection.mockResolvedValueOnce(collectionInfo(1024, 'Cosine'));
    const client = new QdrantProductsClient({ config, qdrant });

    await client.ensureCollection(1024);

    expect(qdrant.createCollection).not.toHaveBeenCalled();
    expect(qdrant.createPayloadIndex).toHaveBeenCalledWith('products', {
      field_name: 'price',
      field_schema: 'integer',
      wait: true,
    });
  });

  it('rejects existing collection vector-size mismatch', async () => {
    const qdrant = mockQdrantClient();
    qdrant.getCollection.mockResolvedValueOnce(collectionInfo(768, 'Cosine'));
    const client = new QdrantProductsClient({ config, qdrant });

    await expect(client.ensureCollection(1024)).rejects.toThrow(
      'Qdrant collection products vector size mismatch: expected 1024, found 768',
    );
  });

  it('upserts stable Qdrant UUID points while preserving Product id payloads', async () => {
    const qdrant = mockQdrantClient();
    const client = new QdrantProductsClient({ config, qdrant });
    const point: ProductVectorPoint = {
      productId: 'product-1',
      vector: [0.1, 0.2, 0.3],
      payload,
    };

    await client.upsertProducts([point]);

    type UpsertBody = {
      wait: boolean;
      points: Array<{
        id: string;
        vector: number[];
        payload: typeof payload;
      }>;
    };
    const upsertMock = qdrant.upsert as jest.MockedFunction<
      (collectionName: string, body: UpsertBody) => Promise<unknown>
    >;
    const [collectionName, upsertBody] = upsertMock.mock.calls[0];

    expect(collectionName).toBe('products');
    expect(upsertBody).toEqual({
      wait: true,
      points: [
        {
          id: upsertBody.points[0].id,
          vector: [0.1, 0.2, 0.3],
          payload,
        },
      ],
    });
    expect(upsertBody.points[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(upsertBody.points[0].payload.productId).toBe('product-1');
  });

  it.each(['raw', 'rawCrawl', 'crawlSnapshot', 'description'])(
    'rejects forbidden payload key %s',
    async (key) => {
      const qdrant = mockQdrantClient();
      const client = new QdrantProductsClient({ config, qdrant });

      await expect(
        client.upsertProducts([
          {
            productId: 'product-1',
            vector: [0.1],
            payload: { ...payload, [key]: 'forbidden' } as typeof payload,
          },
        ]),
      ).rejects.toThrow(
        `Qdrant product payload includes forbidden key: ${key}`,
      );
      expect(qdrant.upsert).not.toHaveBeenCalled();
    },
  );

  it('queries products with deterministic filter shape and payload mapping', async () => {
    const qdrant = mockQdrantClient();
    qdrant.query.mockResolvedValueOnce({
      points: [{ id: 'product-1', score: 0.9, payload }],
    });
    const client = new QdrantProductsClient({ config, qdrant });

    const result = await client.queryProducts([0.1, 0.2], {
      limit: 3,
      filters: {
        category: 'laptop',
        categoryPath: ['Laptop Gaming'],
        minPrice: 10000000,
        maxPrice: 30000000,
        inStockOnly: true,
      },
    });

    expect(qdrant.query).toHaveBeenCalledWith('products', {
      query: [0.1, 0.2],
      filter: {
        must: [
          { key: 'category', match: { value: 'laptop' } },
          { key: 'categoryPath', match: { any: ['Laptop Gaming'] } },
          { key: 'price', range: { gte: 10000000 } },
          { key: 'price', range: { lte: 30000000 } },
          { key: 'stock', range: { gt: 0 } },
          { key: 'isPublished', match: { value: true } },
        ],
        must_not: [{ key: 'isArchived', match: { value: true } }],
      },
      limit: 3,
      with_payload: true,
      with_vector: false,
    });
    expect(result).toEqual([{ productId: 'product-1', score: 0.9, payload }]);
  });

  it('repairs missing payload indexes once and retries the direct vector query', async () => {
    const qdrant = mockQdrantClient();
    qdrant.query
      .mockRejectedValueOnce({
        status: 400,
        data: {
          status: {
            error:
              'Bad request: Index required but not found for "isArchived" of one of the following types: [bool].',
          },
        },
      })
      .mockResolvedValueOnce({
        points: [{ id: 'product-1', score: 0.9, payload }],
      });
    const client = new QdrantProductsClient({ config, qdrant });

    const result = await client.queryProducts([0.1, 0.2], { limit: 1 });

    expect(qdrant.createPayloadIndex).toHaveBeenCalledWith('products', {
      field_name: 'isArchived',
      field_schema: 'bool',
      wait: true,
    });
    expect(qdrant.query).toHaveBeenCalledTimes(2);
    expect(qdrant.query).toHaveBeenLastCalledWith(
      'products',
      expect.objectContaining({ query: [0.1, 0.2], limit: 1 }),
    );
    expect(result).toEqual([{ productId: 'product-1', score: 0.9, payload }]);
  });
  it('scrolls product payload ids for post-index reconciliation', async () => {
    const qdrant = mockQdrantClient();
    qdrant.scroll
      .mockResolvedValueOnce({
        points: [
          { payload: { ...payload, productId: 'product-2' } },
          { payload: { ...payload, productId: 'product-1' } },
        ],
        next_page_offset: 'page-2',
      })
      .mockResolvedValueOnce({
        points: [
          { payload: { ...payload, productId: 'product-2' } },
          { payload: { name: 'missing id' } },
        ],
      });
    const client = new QdrantProductsClient({ config, qdrant });

    await expect(
      client.listProductPayloadIds({ batchSize: 2 }),
    ).resolves.toEqual(['product-1', 'product-2']);
    expect(qdrant.scroll).toHaveBeenNthCalledWith(1, 'products', {
      limit: 2,
      with_payload: true,
      with_vector: false,
    });
    expect(qdrant.scroll).toHaveBeenNthCalledWith(2, 'products', {
      limit: 2,
      with_payload: true,
      with_vector: false,
      offset: 'page-2',
    });
  });
  it('counts products exactly', async () => {
    const qdrant = mockQdrantClient();
    qdrant.count.mockResolvedValueOnce({ count: 12866 });
    const client = new QdrantProductsClient({ config, qdrant });

    await expect(client.countProducts()).resolves.toBe(12866);
    expect(qdrant.count).toHaveBeenCalledWith('products', { exact: true });
  });
});

function mockQdrantClient() {
  return {
    getCollection: jest.fn(),
    recreateCollection: jest.fn(),
    createCollection: jest.fn(),
    createPayloadIndex: jest.fn(),
    upsert: jest.fn(),
    query: jest.fn(),
    scroll: jest.fn(),
    count: jest.fn(),
  };
}

function collectionInfo(size: number, distance: string) {
  return {
    config: {
      params: {
        vectors: { size, distance },
      },
    },
  };
}
