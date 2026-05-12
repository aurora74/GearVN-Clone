export type ProductCorpusSourceCategory = {
  id?: number;
  name?: string;
  uri?: string;
};

export type ProductCorpusSourceProduct = {
  product_id?: number | string;
  name?: string;
  sku?: string;
  manufacturer?: string;
  url_key?: string;
  url?: string;
  category_name?: string;
  sub_category?: string;
  query_category?: string;
  price?: number | string | null;
  special_price?: number | string | null;
  display_price?: number | string | null;
  promotion_percent?: number | string | null;
  thumbnail?: string | null;
  stock_available?: boolean | null;
  categories?: ProductCorpusSourceCategory[];
  specifications?: Record<string, unknown> | null;
  description?: string | null;
  [key: string]: unknown;
};

export type ProductSearchMetadataInput = {
  sourceSku?: string;
  sourceUrlKey?: string;
  normalizedName?: string;
  categoryPath?: string[];
  normalizedSpecs?: Record<string, unknown>;
  specsSummary?: string;
  semanticTags?: string[];
  useCases?: string[];
  targetUsers?: string[];
  searchText?: string;
  sourceProductId?: string;
  manufacturer?: string;
};

export type NormalizedProductInput = {
  sourceKey: string;
  name: string;
  slug: string;
  category: string;
  categoryLabel: string;
  categoryPath: string[];
  price: number;
  discountPrice: number;
  discountPercent: number;
  description?: string;
  images: string[];
  attributes: Record<string, unknown>;
  stock: number;
  isPublished: true;
  publishedAt: Date;
  isArchived: false;
  searchMetadata: ProductSearchMetadataInput;
};

export type ProductMatchKey = {
  type: 'sku' | 'url_key' | 'normalized_name';
  value: string;
};

export type NormalizeSkipReason =
  | 'invalid_name'
  | 'invalid_slug'
  | 'invalid_category'
  | 'invalid_price'
  | 'invalid_discount'
  | 'missing_image';

export type NormalizedProductResult =
  | { ok: true; value: NormalizedProductInput }
  | { ok: false; reason: NormalizeSkipReason; sourceKey: string };

export type CounterMap = Record<string, number>;

export type ProductCorpusProfileReport = {
  sourceFile: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateCandidates: number;
  slugDuplicateGroups: Array<{ key: string; count: number }>;
  categoryDistribution: CounterMap;
  priceAnomalies: Array<{
    row: number;
    sourceKey: string;
    reason: NormalizeSkipReason;
  }>;
  stockDistribution: {
    inStock: number;
    outOfStock: number;
  };
  specCoverage: CounterMap;
  skippedReasons: CounterMap;
};

export type ProductCorpusImportReport = {
  sourceFile?: string;
  dryRun: boolean;
  totalRows: number;
  processed: number;
  created: number;
  updated: number;
  skipped: Array<{ row: number; sourceKey: string; reason: string }>;
  errors: Array<{ row: number; sourceKey: string; message: string }>;
  preCounts: { products: number; categories: number };
  postCounts: { products: number; categories: number };
  duplicateCheck: {
    passed: boolean;
    conflicts: number;
    groups: Array<{ key: string; count: number }>;
  };
};
