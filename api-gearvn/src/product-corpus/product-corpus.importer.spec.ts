import { normalizeCrawlProduct } from './product-corpus.normalizer';
import { ProductCorpusImporter } from './product-corpus.importer';
import { NormalizedProductInput } from './product-corpus.types';

const baseRow = {
  product_id: 1,
  name: 'Laptop Gaming Alpha RTX 16GB',
  sku: 'alpha-rtx-16gb',
  url_key: 'laptop-gaming-alpha-rtx-16gb',
  category_name: 'Laptop',
  price: 25000000,
  special_price: 23000000,
  display_price: 23000000,
  stock_available: true,
  categories: [
    { name: 'Root', uri: 'default-category' },
    { name: 'Laptop', uri: 'laptop' },
    { name: 'Laptop Gaming', uri: 'laptop-gaming' },
  ],
  specifications: {
    CPU: 'Intel Core i7',
    GPU: 'RTX 4060',
    RAM: '16 GB',
  },
  description: 'Gaming and productivity laptop.',
};

const normalizedFrom = (overrides: Record<string, unknown> = {}) => {
  const normalized = normalizeCrawlProduct({ ...baseRow, ...overrides });
  if (!normalized.ok) throw new Error(`fixture invalid: ${normalized.reason}`);
  return normalized.value;
};

class MemoryCollection {
  docs: any[];
  deleteOne = jest.fn();
  deleteMany = jest.fn();

  constructor(seed: any[] = []) {
    this.docs = seed.map((doc) => ({ ...doc }));
  }

  countDocuments = jest.fn(async () => this.docs.length);

  create = jest.fn(async (doc: any) => {
    const created = {
      _id: `${this.docs.length + 1}`,
      ...doc,
      save: jest.fn(async function (this: any) {
        return this;
      }),
    };
    this.docs.push(created);
    return created;
  });

  findOne = jest.fn((query: Record<string, unknown>) => ({
    exec: async () => this.docs.find((doc) => matches(doc, query)) ?? null,
  }));
}

class BulkCollection {
  private readonly seed: any[];

  constructor(seed: any[] = []) {
    this.seed = seed.map((doc) => ({ ...doc }));
  }

  countDocuments = jest.fn(async () => this.seed.length);
  create = jest.fn();
  findOne = jest.fn((query: Record<string, unknown>) => ({
    exec: async () => this.seed.find((doc) => matches(doc, query)) ?? null,
  }));
  find = jest.fn(() => ({
    exec: async () => this.seed.map((doc) => ({ ...doc })),
  }));
  bulkWrite = jest.fn(async (_ops: any[], _options: { ordered: boolean }) => undefined);
}

function matches(doc: any, query: Record<string, unknown>): boolean {
  return Object.entries(query).every(([key, expected]) => {
    if (key === '$or' && Array.isArray(expected)) {
      return expected.some((branch) => matches(doc, branch));
    }
    if (
      typeof expected === 'object' &&
      expected !== null &&
      '$ne' in expected
    ) {
      return readPath(doc, key) !== (expected as { $ne: unknown }).$ne;
    }
    return readPath(doc, key) === expected;
  });
}

function readPath(doc: any, path: string): unknown {
  return path.split('.').reduce((value, part) => value?.[part], doc);
}

describe('ProductCorpusImporter', () => {
  it('upserts categories and products idempotently without deleting unmatched products', async () => {
    const productModel = new MemoryCollection([
      { _id: 'demo', name: 'Existing Demo', slug: 'existing-demo' },
    ]);
    const categoryModel = new MemoryCollection();
    const importer = new ProductCorpusImporter(
      productModel as any,
      categoryModel as any,
    );
    const input = normalizedFrom();

    const first = await importer.importNormalizedProducts([input]);
    const second = await importer.importNormalizedProducts([input]);

    expect(first).toMatchObject({
      created: 1,
      updated: 0,
      preCounts: { products: 1, categories: 0 },
      postCounts: { products: 2, categories: 1 },
      duplicateCheck: { passed: true, conflicts: 0 },
    });
    expect(second).toMatchObject({
      created: 0,
      updated: 1,
      skipped: [],
      duplicateCheck: { passed: true, conflicts: 0 },
    });
    expect(productModel.docs).toHaveLength(2);
    expect(productModel.docs.some((doc) => doc._id === 'demo')).toBe(true);
    expect(productModel.deleteOne).not.toHaveBeenCalled();
    expect(productModel.deleteMany).not.toHaveBeenCalled();
    expect(categoryModel.docs[0]).toEqual(
      expect.objectContaining({
        name: 'laptop',
        label: 'Laptop',
        isPublished: true,
        isArchived: false,
        sourceMetadata: expect.objectContaining({
          source: 'product-corpus-import',
          crawlPaths: ['Laptop', 'Laptop Gaming'],
        }),
      }),
    );
  });

  it('matches products by sku before url_key and by url_key before normalized name', async () => {
    const skuInput = normalizedFrom({ price: 26000000 });
    const urlKeyInput = normalizedFrom({
      sku: '',
      url_key: 'url-only-alpha',
      name: 'Laptop Gaming Alpha URL Only',
    });
    const productModel = new MemoryCollection([
      {
        _id: 'sku-match',
        category: 'laptop',
        price: 1,
        searchMetadata: { sourceSku: 'alpha-rtx-16gb' },
        save: jest.fn(async function (this: any) {
          return this;
        }),
      },
      {
        _id: 'url-match',
        category: 'laptop',
        price: 1,
        searchMetadata: { sourceUrlKey: 'url-only-alpha' },
        save: jest.fn(async function (this: any) {
          return this;
        }),
      },
    ]);
    const importer = new ProductCorpusImporter(
      productModel as any,
      new MemoryCollection() as any,
    );

    const report = await importer.importNormalizedProducts([
      skuInput,
      urlKeyInput,
    ]);

    expect(report).toMatchObject({ created: 0, updated: 2 });
    expect(
      productModel.docs.find((doc) => doc._id === 'sku-match')?.price,
    ).toBe(26000000);
    expect(productModel.docs.find((doc) => doc._id === 'url-match')?.name).toBe(
      'Laptop Gaming Alpha URL Only',
    );
  });

  it('skips guarded normalized-name fallback when category, specs, or price conflict', async () => {
    const input: NormalizedProductInput = {
      ...normalizedFrom({ sku: '', url_key: '' }),
      category: 'laptop',
      price: 25000000,
      searchMetadata: {
        ...normalizedFrom().searchMetadata,
        sourceSku: '',
        sourceUrlKey: '',
      },
    };
    const productModel = new MemoryCollection([
      {
        _id: 'conflict',
        category: 'dien-thoai',
        price: 990000,
        attributes: { CPU: 'Other' },
        searchMetadata: {
          normalizedName: input.searchMetadata.normalizedName,
        },
        save: jest.fn(),
      },
    ]);
    const importer = new ProductCorpusImporter(
      productModel as any,
      new MemoryCollection() as any,
    );

    const report = await importer.importNormalizedProducts([input]);

    expect(report.created).toBe(0);
    expect(report.updated).toBe(0);
    expect(report.skipped).toEqual([
      { row: 0, sourceKey: input.sourceKey, reason: 'duplicate_conflict' },
    ]);
  });

  it('reports invalid rows and continues processing valid rows', async () => {
    const importer = new ProductCorpusImporter(
      new MemoryCollection() as any,
      new MemoryCollection() as any,
    );
    const valid = normalizedFrom();

    const report = await importer.importNormalizedProducts([
      { ok: false, reason: 'invalid_price', sourceKey: 'bad-row' },
      valid,
    ]);

    expect(report.created).toBe(1);
    expect(report.skipped).toEqual([
      { row: 0, sourceKey: 'bad-row', reason: 'invalid_price' },
    ]);
    expect(report.errors).toEqual([]);
  });

  it('uses import batchSize for product bulk write chunks while preserving category chunking', async () => {
    const productModel = new BulkCollection();
    const categoryModel = new BulkCollection();
    const importer = new ProductCorpusImporter(productModel as any, categoryModel as any);
    const inputs = [
      normalizedFrom(),
      normalizedFrom({
        product_id: 2,
        sku: 'alpha-rtx-16gb-2',
        url_key: 'laptop-gaming-alpha-rtx-16gb-2',
        name: 'Laptop Gaming Alpha RTX 16GB 2',
      }),
      normalizedFrom({
        product_id: 3,
        sku: 'alpha-rtx-16gb-3',
        url_key: 'laptop-gaming-alpha-rtx-16gb-3',
        name: 'Laptop Gaming Alpha RTX 16GB 3',
      }),
    ];

    await importer.importNormalizedProducts(inputs, { batchSize: 2 });

    expect(productModel.bulkWrite).toHaveBeenCalledTimes(2);
    expect(productModel.bulkWrite.mock.calls.map(([ops]) => ops.length)).toEqual([
      2,
      1,
    ]);
    expect(categoryModel.bulkWrite).toHaveBeenCalledTimes(1);
    expect(categoryModel.bulkWrite.mock.calls[0][0]).toHaveLength(1);
  });
});
