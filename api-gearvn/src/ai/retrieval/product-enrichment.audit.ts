import { buildSpecsSummary } from '../../product-corpus/product-corpus.normalizer';
import {
  buildProductSearchDocument,
  ProductDocumentLike,
} from './product-search-document.builder';

export const PRODUCT_ENRICHMENT_FIELDS = [
  'categoryPath',
  'specsSummary',
  'semanticTags',
  'useCases',
  'targetUsers',
  'searchText',
] as const;

export type ProductEnrichmentField = (typeof PRODUCT_ENRICHMENT_FIELDS)[number];
export type ProductEnrichmentIssueReason = 'missing' | 'empty' | 'changed';

export type ProductSearchMetadataLike = NonNullable<
  ProductDocumentLike['searchMetadata']
>;

export type ProductEnrichmentIssue = {
  productId: string;
  name: string;
  field: ProductEnrichmentField;
  reason: ProductEnrichmentIssueReason;
};

export type ProductEnrichmentRecommendedUpdate = {
  productId: string;
  searchMetadata: ProductSearchMetadataLike;
};

export type ProductEnrichmentAuditReport = {
  checked: number;
  missingByField: Record<ProductEnrichmentField, number>;
  emptyByField: Record<ProductEnrichmentField, number>;
  changedSearchTextIds: string[];
  recommendedUpdates: ProductEnrichmentRecommendedUpdate[];
  refreshRequired: boolean;
  sampleIssues: ProductEnrichmentIssue[];
  secretKeysLogged: false;
};

export type ProductEnrichmentRefreshSummary = Pick<
  ProductEnrichmentAuditReport,
  | 'checked'
  | 'changedSearchTextIds'
  | 'recommendedUpdates'
  | 'refreshRequired'
  | 'secretKeysLogged'
>;

const SAMPLE_ISSUE_LIMIT = 20;

export function auditProductEnrichment(
  products: ProductDocumentLike[],
): ProductEnrichmentAuditReport {
  const missingByField = emptyFieldCounter();
  const emptyByField = emptyFieldCounter();
  const sampleIssues: ProductEnrichmentIssue[] = [];
  const changedSearchTextIds: string[] = [];
  const recommendedUpdates: ProductEnrichmentRecommendedUpdate[] = [];

  for (const product of products) {
    const metadata = product.searchMetadata ?? {};
    const productId = productIdFor(product);
    const name = cleanText(product.name);
    let coverageIssueFound = false;

    for (const field of PRODUCT_ENRICHMENT_FIELDS) {
      if (
        !Object.prototype.hasOwnProperty.call(metadata, field) ||
        metadata[field] === undefined
      ) {
        missingByField[field] += 1;
        coverageIssueFound = true;
        pushSampleIssue(sampleIssues, { productId, name, field, reason: 'missing' });
        continue;
      }

      if (isEmptyValue(metadata[field])) {
        emptyByField[field] += 1;
        coverageIssueFound = true;
        pushSampleIssue(sampleIssues, { productId, name, field, reason: 'empty' });
      }
    }

    const improvedMetadata = buildImprovedProductSearchMetadata(product);
    const storedSearchText = cleanText(metadata.searchText);
    const improvedSearchText = cleanText(improvedMetadata.searchText);
    const searchTextChanged = storedSearchText !== improvedSearchText;

    if (searchTextChanged) {
      changedSearchTextIds.push(productId);
      pushSampleIssue(sampleIssues, {
        productId,
        name,
        field: 'searchText',
        reason: 'changed',
      });
    }

    if (coverageIssueFound || searchTextChanged) {
      recommendedUpdates.push({
        productId,
        searchMetadata: improvedMetadata,
      });
    }
  }

  return {
    checked: products.length,
    missingByField,
    emptyByField,
    changedSearchTextIds,
    recommendedUpdates,
    refreshRequired: recommendedUpdates.length > 0,
    sampleIssues,
    secretKeysLogged: false,
  };
}

export function summarizeEnrichmentRefreshNeed(
  products: ProductDocumentLike[],
): ProductEnrichmentRefreshSummary {
  const report = auditProductEnrichment(products);
  return {
    checked: report.checked,
    refreshRequired: report.refreshRequired,
    changedSearchTextIds: report.changedSearchTextIds,
    recommendedUpdates: report.recommendedUpdates,
    secretKeysLogged: false,
  };
}

export function buildImprovedProductSearchMetadata(
  product: ProductDocumentLike,
): ProductSearchMetadataLike {
  const metadata = product.searchMetadata ?? {};
  const categoryPath = normalizeStringArray(metadata.categoryPath);
  const normalizedSpecs = normalizeSpecs(metadata.normalizedSpecs ?? product.attributes);
  const specsSummary =
    cleanText(metadata.specsSummary) ||
    (Object.keys(normalizedSpecs).length > 0
      ? buildSpecsSummary(normalizedSpecs)
      : undefined);
  const semanticTags = normalizeStringArray(metadata.semanticTags);
  const useCases = normalizeStringArray(metadata.useCases);
  const targetUsers = normalizeStringArray(metadata.targetUsers);

  const nextMetadata: ProductSearchMetadataLike = {
    ...metadata,
    categoryPath: categoryPath.length > 0 ? categoryPath : fallbackCategoryPath(product),
    normalizedSpecs,
    ...(specsSummary ? { specsSummary } : {}),
    semanticTags,
    useCases,
    targetUsers,
  };

  const derivedSearchDocument = buildProductSearchDocument({
    ...product,
    searchMetadata: {
      ...nextMetadata,
      searchText: undefined,
    },
  });

  nextMetadata.searchText = derivedSearchDocument.searchText;
  return nextMetadata;
}

function emptyFieldCounter(): Record<ProductEnrichmentField, number> {
  return PRODUCT_ENRICHMENT_FIELDS.reduce(
    (counter, field) => {
      counter[field] = 0;
      return counter;
    },
    {} as Record<ProductEnrichmentField, number>,
  );
}

function pushSampleIssue(
  sampleIssues: ProductEnrichmentIssue[],
  issue: ProductEnrichmentIssue,
): void {
  if (sampleIssues.length < SAMPLE_ISSUE_LIMIT) {
    sampleIssues.push(issue);
  }
}

function isEmptyValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'string') return cleanText(value).length === 0;
  if (!value || typeof value !== 'object') return value === null || value === undefined;
  return Object.keys(value).length === 0;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(cleanText).filter(Boolean);
}

function normalizeSpecs(value: unknown): Record<string, unknown> {
  const source =
    value instanceof Map
      ? Object.fromEntries(value.entries())
      : value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};

  return Object.entries(source)
    .sort(([left], [right]) => left.localeCompare(right))
    .reduce<Record<string, unknown>>((specs, [key, specValue]) => {
      const cleanKey = cleanText(key);
      if (
        cleanKey &&
        specValue !== undefined &&
        specValue !== null &&
        specValue !== ''
      ) {
        specs[cleanKey] = typeof specValue === 'string' ? cleanText(specValue) : specValue;
      }
      return specs;
    }, {});
}

function fallbackCategoryPath(product: ProductDocumentLike): string[] {
  const category = cleanText(product.category);
  return category ? [category] : [];
}

function productIdFor(product: ProductDocumentLike): string {
  const value = product._id ?? product.id;
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'toString' in value) return String(value);
  return '';
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}
