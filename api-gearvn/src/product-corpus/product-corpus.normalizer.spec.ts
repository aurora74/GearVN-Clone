import {
  CRAWL_PLACEHOLDER_IMAGE_URL,
  DEFAULT_IMPORTED_STOCK,
  buildProductMatchKeys,
  normalizeCrawlProduct,
  profileCrawlProducts,
} from './product-corpus.normalizer';

const validRow = {
  product_id: 112588,
  name: 'iPhone 17 Pro Max 256GB | Chính hãng',
  sku: 'iphone-17-pro-max',
  url_key: 'iphone-17-pro-max',
  category_name: 'Điện thoại',
  price: 37990000,
  special_price: 36990000,
  display_price: 36990000,
  stock_available: true,
  categories: [
    { id: 2, name: 'Root', uri: 'default-category' },
    { id: 3, name: 'Điện thoại', uri: 'mobile' },
    { id: 132, name: 'Apple', uri: 'apple' },
  ],
  specifications: {
    'Kích thước màn hình': '6.9 inches',
    Chipset: 'A19 Pro',
    'Dung lượng RAM': '8 GB',
    'Bộ nhớ trong': '256 GB',
  },
  description: 'Flagship phone with strong camera and gaming performance.',
};

describe('product corpus normalizer', () => {
  it('maps crawl prices, stock, placeholder image, category path, and search metadata', () => {
    const normalized = normalizeCrawlProduct(validRow);

    expect(normalized.ok).toBe(true);
    if (!normalized.ok) return;

    expect(normalized.value).toEqual(
      expect.objectContaining({
        name: validRow.name,
        slug: 'iphone-17-pro-max',
        category: 'dien-thoai',
        price: 37990000,
        discountPrice: 36990000,
        discountPercent: 3,
        stock: DEFAULT_IMPORTED_STOCK,
        images: [CRAWL_PLACEHOLDER_IMAGE_URL],
      }),
    );
    expect(normalized.value.attributes).toEqual(validRow.specifications);
    expect(normalized.value.searchMetadata).toEqual(
      expect.objectContaining({
        sourceSku: 'iphone-17-pro-max',
        sourceUrlKey: 'iphone-17-pro-max',
        normalizedName: 'iphone 17 pro max 256gb chinh hang',
        categoryPath: ['Điện thoại', 'Apple'],
        normalizedSpecs: validRow.specifications,
      }),
    );
    expect(normalized.value.searchMetadata.specsSummary).toContain(
      'Chipset: A19 Pro',
    );
    expect(normalized.value.searchMetadata.semanticTags).toEqual(
      expect.arrayContaining(['apple', 'a19 pro', '8 gb', '256 gb']),
    );
    expect(normalized.value.searchMetadata.useCases).toEqual(
      expect.arrayContaining(['gaming', 'photography']),
    );
    expect(normalized.value.searchMetadata.targetUsers).toEqual(
      expect.arrayContaining(['power-user']),
    );
    expect(normalized.value.searchMetadata.searchText).toContain(
      'Flagship phone',
    );
    expect(normalized.value).not.toHaveProperty('raw');
  });

  it('parses localized Vietnamese currency strings without regressing numeric prices', () => {
    const dotPrice = normalizeCrawlProduct({
      ...validRow,
      price: '37.990.000 VND',
      special_price: '36.990.000 VND',
      display_price: '36.990.000 VND',
    });
    const commaPrice = normalizeCrawlProduct({
      ...validRow,
      price: '37,990,000',
      special_price: '36,990,000',
      display_price: '36,990,000',
    });
    const numericPrice = normalizeCrawlProduct({
      ...validRow,
      price: 37990000,
      special_price: 36990000,
      display_price: 36990000,
    });

    expect(dotPrice).toMatchObject({
      ok: true,
      value: { price: 37990000, discountPrice: 36990000 },
    });
    expect(commaPrice).toMatchObject({
      ok: true,
      value: { price: 37990000, discountPrice: 36990000 },
    });
    expect(numericPrice).toMatchObject({
      ok: true,
      value: { price: 37990000, discountPrice: 36990000 },
    });
  });

  it('maps unavailable stock to zero and rejects invalid price rows with skip reasons', () => {
    expect(
      normalizeCrawlProduct({ ...validRow, stock_available: false }),
    ).toMatchObject({
      ok: true,
      value: { stock: 0 },
    });

    expect(
      normalizeCrawlProduct({ ...validRow, price: 0, display_price: 0 }),
    ).toEqual({
      ok: false,
      reason: 'invalid_price',
      sourceKey: 'iphone-17-pro-max',
    });
  });

  it('builds dedupe keys in sku, url_key, guarded normalized-name priority order', () => {
    expect(buildProductMatchKeys(normalizeCrawlProduct(validRow))).toEqual([
      { type: 'sku', value: 'iphone-17-pro-max' },
      { type: 'url_key', value: 'iphone-17-pro-max' },
      { type: 'normalized_name', value: 'iphone 17 pro max 256gb chinh hang' },
    ]);
  });

  it('profiles duplicates, categories, price anomalies, stock, specs, and skip reasons', () => {
    const report = profileCrawlProducts([
      validRow,
      { ...validRow, product_id: 2, sku: 'iphone-17-pro-max-duplicate' },
      { ...validRow, product_id: 3, sku: 'bad-price', price: 0 },
    ]);

    expect(report).toEqual(
      expect.objectContaining({
        sourceFile: 'data/products_crawl.json',
        totalRows: 3,
        validRows: 2,
        invalidRows: 1,
        duplicateCandidates: 1,
      }),
    );
    expect(report.slugDuplicateGroups).toEqual([
      { key: 'iphone-17-pro-max', count: 2 },
    ]);
    expect(report.categoryDistribution).toEqual({ 'Điện thoại': 2 });
    expect(report.priceAnomalies).toEqual([
      { row: 2, sourceKey: 'bad-price', reason: 'invalid_price' },
    ]);
    expect(report.stockDistribution).toEqual({ inStock: 2, outOfStock: 0 });
    expect(report.specCoverage).toEqual(
      expect.objectContaining({
        Chipset: 2,
        'Dung lượng RAM': 2,
      }),
    );
    expect(report.skippedReasons).toEqual({ invalid_price: 1 });
  });
});
