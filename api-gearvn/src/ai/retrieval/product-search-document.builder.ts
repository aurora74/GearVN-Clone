import {
  ProductSearchDocument,
  ProductSearchPayload,
} from './product-retrieval.types';

type ProductSearchMetadataLike = {
  categoryPath?: string[];
  normalizedSpecs?: Record<string, unknown>;
  specsSummary?: string;
  semanticTags?: string[];
  useCases?: string[];
  targetUsers?: string[];
  searchText?: string;
  [key: string]: unknown;
};

export type ProductDocumentLike = {
  _id?: unknown;
  id?: unknown;
  name?: string;
  slug?: string;
  category?: string;
  price?: number;
  discountPrice?: number;
  stock?: number;
  isPublished?: boolean;
  isArchived?: boolean;
  description?: string;
  attributes?: Record<string, unknown> | Map<string, unknown>;
  searchMetadata?: ProductSearchMetadataLike;
};

const MAX_TEXT_PART_LENGTH = 240;
const MAX_ATTRIBUTE_PARTS = 12;

export function buildProductSearchDocument(
  product: ProductDocumentLike,
): ProductSearchDocument {
  const metadata = product.searchMetadata ?? {};
  const productId = toId(product._id ?? product.id);
  const categoryPath = normalizeStringArray(metadata.categoryPath);
  const semanticTags = normalizeStringArray(metadata.semanticTags);
  const useCases = normalizeStringArray(metadata.useCases);
  const targetUsers = normalizeStringArray(metadata.targetUsers);
  const normalizedSpecs = normalizeSpecs(metadata.normalizedSpecs);

  const payload: ProductSearchPayload = {
    productId,
    name: normalizeString(product.name),
    slug: normalizeString(product.slug),
    category: normalizeString(product.category),
    categoryPath,
    price: normalizeNumber(product.price),
    discountPrice: normalizeNumber(product.discountPrice),
    stock: normalizeNumber(product.stock),
    isPublished: product.isPublished !== false,
    isArchived: product.isArchived === true,
    semanticTags,
    useCases,
    targetUsers,
    ...(normalizedSpecs ? { normalizedSpecs } : {}),
  };

  return {
    productId,
    searchText: buildSearchText(product, metadata, {
      categoryPath,
      semanticTags,
      useCases,
      targetUsers,
    }),
    payload,
  };
}

function buildSearchText(
  product: ProductDocumentLike,
  metadata: ProductSearchMetadataLike,
  normalized: Pick<
    ProductSearchPayload,
    'categoryPath' | 'semanticTags' | 'useCases' | 'targetUsers'
  >,
): string {
  const explicitSearchText = normalizeString(metadata.searchText);
  if (explicitSearchText) return explicitSearchText;

  return uniqueParts([
    product.name,
    ...normalized.categoryPath,
    metadata.specsSummary,
    ...normalized.semanticTags,
    ...normalized.useCases,
    ...normalized.targetUsers,
    product.description,
    ...attributeParts(product.attributes),
  ]);
}

function attributeParts(
  attributes: ProductDocumentLike['attributes'],
): string[] {
  if (!attributes) return [];

  const entries =
    attributes instanceof Map
      ? Array.from(attributes.entries())
      : Object.entries(attributes);

  return entries
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, MAX_ATTRIBUTE_PARTS)
    .map(([key, value]) => {
      const normalizedValue = normalizeUnknown(value);
      return normalizedValue ? `${key}: ${normalizedValue}` : '';
    })
    .filter(Boolean);
}

function normalizeString(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, MAX_TEXT_PART_LENGTH);
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeString).filter(Boolean);
}

function normalizeSpecs(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .reduce<Record<string, unknown>>((specs, [key, specValue]) => {
      if (specValue !== undefined && specValue !== null && specValue !== '') {
        specs[key] = specValue;
      }
      return specs;
    }, {});
}

function normalizeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeUnknown(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(normalizeString).filter(Boolean).join(', ');
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return normalizeString(value);
}

function uniqueParts(values: unknown[]): string {
  const seen = new Set<string>();
  const parts: string[] = [];

  for (const value of values) {
    const part = normalizeUnknown(value);
    if (!part || seen.has(part)) continue;
    seen.add(part);
    parts.push(part);
  }

  return parts.join(' | ');
}

function toId(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'toString' in value) {
    return String(value);
  }
  return '';
}
