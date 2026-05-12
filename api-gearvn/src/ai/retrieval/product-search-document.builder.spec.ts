import { readAiRetrievalConfig } from '../config/ai-retrieval.config';
import { buildProductSearchDocument } from './product-search-document.builder';

describe('AI retrieval config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_EMBEDDING_MODEL;
    delete process.env.OPENROUTER_CHAT_MODEL;
    delete process.env.QDRANT_URL;
    delete process.env.QDRANT_API_KEY;
    delete process.env.QDRANT_COLLECTION;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('uses deterministic OpenRouter and Qdrant defaults without requiring secrets', () => {
    const config = readAiRetrievalConfig();

    expect(config.openRouter.embeddingModel).toBe('baai/bge-m3');
    expect(config.openRouter.chatModel).toBeUndefined();
    expect(config.qdrant.collection).toBe('products');
    expect(config.openRouter.apiKeyPresent).toBe(false);
    expect(config.qdrant.apiKeyPresent).toBe(false);
  });

  it('throws with missing env var names only when secrets are required', () => {
    expect(() => readAiRetrievalConfig({ requireSecrets: true })).toThrow(
      'OPENROUTER_API_KEY, QDRANT_URL, QDRANT_API_KEY',
    );
  });
});

describe('buildProductSearchDocument', () => {
  it('uses enriched search metadata for deterministic text and minimal payload', () => {
    const document = buildProductSearchDocument({
      _id: 'product-1',
      name: 'Laptop Gaming ABC',
      slug: 'laptop-gaming-abc',
      category: 'laptop',
      price: 25000000,
      discountPrice: 23000000,
      stock: 7,
      isPublished: true,
      isArchived: false,
      description: 'Full raw marketing description should not enter payload.',
      attributes: { cpu: 'Ryzen 7', ram: '16GB' },
      searchMetadata: {
        categoryPath: ['Laptop', 'Laptop Gaming'],
        normalizedSpecs: { cpu: 'Ryzen 7', ram: '16GB' },
        specsSummary: 'Ryzen 7, RAM 16GB, RTX 4060',
        semanticTags: ['gaming', 'do hoa'],
        useCases: ['choi game', 'lap trinh AI'],
        targetUsers: ['sinh vien', 'creator'],
        searchText: 'custom enriched search text',
      },
    });

    expect(document).toEqual({
      productId: 'product-1',
      searchText: 'custom enriched search text',
      payload: expect.objectContaining({
        productId: 'product-1',
        name: 'Laptop Gaming ABC',
        slug: 'laptop-gaming-abc',
        category: 'laptop',
        categoryPath: ['Laptop', 'Laptop Gaming'],
        price: 25000000,
        discountPrice: 23000000,
        stock: 7,
        isPublished: true,
        isArchived: false,
        semanticTags: ['gaming', 'do hoa'],
        useCases: ['choi game', 'lap trinh AI'],
        targetUsers: ['sinh vien', 'creator'],
      }),
    });
    expect(document.payload).not.toHaveProperty('description');
    expect(document.payload).not.toHaveProperty('raw');
    expect(document.payload).not.toHaveProperty('rawCrawl');
    expect(document.payload).not.toHaveProperty('crawlSnapshot');
  });

  it('falls back to stable product fields when searchText is missing', () => {
    const document = buildProductSearchDocument({
      _id: { toString: () => 'product-2' },
      name: 'Man hinh bao ve mat',
      slug: 'man-hinh-bao-ve-mat',
      category: 'monitor',
      price: 4500000,
      discountPrice: 4200000,
      stock: 0,
      attributes: { size: '27 inch', hz: 100 },
      searchMetadata: {
        categoryPath: ['Man hinh'],
        specsSummary: '27 inch, 100Hz',
        semanticTags: ['eye comfort'],
        useCases: ['work from home'],
        targetUsers: ['nhan vien van phong'],
      },
    });

    expect(document.searchText).toContain('Man hinh bao ve mat');
    expect(document.searchText).toContain('Man hinh');
    expect(document.searchText).toContain('27 inch, 100Hz');
    expect(document.searchText).toContain('eye comfort');
    expect(document.searchText).toContain('work from home');
    expect(document.searchText).toContain('nhan vien van phong');
    expect(document.searchText).toContain('hz: 100');
    expect(document.payload.isPublished).toBe(true);
    expect(document.payload.isArchived).toBe(false);
  });
});
