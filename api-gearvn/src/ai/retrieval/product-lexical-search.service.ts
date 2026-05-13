import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';

import { Product, ProductDocument } from '../../product/product.schema';
import {
  ProductCandidate,
  ProductRetrievalConstraints,
  ProductSearchPayload,
} from './product-retrieval.types';
import {
  expandWithTechDictionary,
  normalizeDictionaryText,
} from './product-domain-dictionary';
import { productFamilyCategoryAliases } from './product-family-taxonomy';

type ProductLexicalRecord = {
  _id: unknown;
  name?: string;
  slug?: string;
  category?: string;
  price?: number;
  discountPrice?: number;
  stock?: number;
  attributes?: Record<string, unknown>;
  isPublished?: boolean;
  isArchived?: boolean;
  searchMetadata?: {
    categoryPath?: string[];
    normalizedSpecs?: Record<string, unknown>;
    semanticTags?: string[];
    useCases?: string[];
    targetUsers?: string[];
    searchText?: string;
  };
};

type LexicalSearchOptions = {
  limit?: number;
  constraints?: ProductRetrievalConstraints;
};

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 80;
const FIELD_WEIGHTS: Record<string, number> = {
  name: 4,
  category: 3,
  attributes: 2,
  categoryPath: 2,
  normalizedSpecs: 2.5,
  semanticTags: 3,
  useCases: 2.5,
  targetUsers: 2,
};

@Injectable()
export class ProductLexicalSearchService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  async search(
    query: string,
    options: LexicalSearchOptions = {},
  ): Promise<ProductCandidate[]> {
    const limit = Math.min(
      Math.max(options.limit ?? DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const terms = uniqueTerms([
      ...splitTerms(query),
      ...expandWithTechDictionary(query).flatMap(splitTerms),
    ]).slice(0, 24);

    if (terms.length === 0) return [];

    const filter = buildMongoFilter(terms, options.constraints);
    const records = await this.productModel
      .find(filter)
      .select(
        '_id name slug category price discountPrice stock attributes isPublished isArchived searchMetadata',
      )
      .limit(limit)
      .lean()
      .exec();

    return records
      .map((record) => scoreRecord(record as ProductLexicalRecord, terms))
      .filter((candidate): candidate is ProductCandidate => Boolean(candidate))
      .sort(
        (left, right) => (right.lexicalScore ?? 0) - (left.lexicalScore ?? 0),
      )
      .slice(0, limit);
  }
}

function buildMongoFilter(
  terms: string[],
  constraints?: ProductRetrievalConstraints,
): FilterQuery<ProductDocument> {
  const regexes = terms
    .slice(0, 12)
    .map((term) => new RegExp(escapeRegex(term), 'i'));
  const searchFields = [
    'name',
    'category',
    'searchMetadata.categoryPath',
    'searchMetadata.searchText',
    'searchMetadata.semanticTags',
    'searchMetadata.useCases',
    'searchMetadata.targetUsers',
  ];

  const filter: FilterQuery<ProductDocument> = {
    isPublished: true,
    isArchived: { $ne: true },
    $or: searchFields.flatMap((field) =>
      regexes.map((regex) => ({ [field]: regex })),
    ),
  };

  const categoryFilter = categoryConstraintFilter([
    constraints?.category,
    ...(constraints?.categoryHints ?? []),
  ]);
  if (categoryFilter) filter.$and = [...(filter.$and ?? []), categoryFilter];
  if (constraints?.inStockOnly) filter.stock = { $gt: 0 };
  if (
    typeof constraints?.minPrice === 'number' ||
    typeof constraints?.maxPrice === 'number'
  ) {
    filter.$and = [
      ...(filter.$and ?? []),
      {
        $or: [
          priceRangeFilter('discountPrice', constraints),
          priceRangeFilter('price', constraints),
        ],
      },
    ];
  }

  return filter;
}

function categoryConstraintFilter(
  categories?: Array<string | undefined>,
): FilterQuery<ProductDocument> | null {
  const normalizedCategories = uniqueTerms(
    (categories ?? []).filter((category): category is string =>
      Boolean(category),
    ),
  );
  if (normalizedCategories.length === 0) return null;

  const aliases = uniqueAliases(
    normalizedCategories.flatMap((category) =>
      productFamilyCategoryAliases(category),
    ),
  );
  const regexes = aliases.map(categoryAliasRegex);
  const fields = [
    'name',
    'category',
    'searchMetadata.categoryPath',
    'searchMetadata.semanticTags',
    'searchMetadata.useCases',
    'searchMetadata.targetUsers',
  ];
  const categoryMatch = {
    $or: fields.flatMap((field) =>
      regexes.map((regex) => ({ [field]: regex })),
    ),
  };

  if (!normalizedCategories.includes('pc')) return categoryMatch;

  return {
    $and: [
      categoryMatch,
      {
        name: {
          $not: /(^|[^a-z0-9])(?:laptop|macbook|notebook)(?=$|[^a-z0-9])/i,
        },
      },
      {
        category: {
          $not: /(^|[^a-z0-9])(?:laptop|macbook|notebook)(?=$|[^a-z0-9])/i,
        },
      },
      {
        'searchMetadata.categoryPath': {
          $not: /(^|[^a-z0-9])(?:laptop|macbook|notebook)(?=$|[^a-z0-9])/i,
        },
      },
    ],
  };
}

const CATEGORY_ALIAS_BOUNDARY = '[^a-z0-9À-ỹ]';

function categoryAliasRegex(alias: string): RegExp {
  return new RegExp(
    `(^|${CATEGORY_ALIAS_BOUNDARY})${escapeRegex(alias)}(?=$|${CATEGORY_ALIAS_BOUNDARY})`,
    'i',
  );
}

function uniqueAliases(aliases: string[]): string[] {
  return Array.from(
    new Set(aliases.map((alias) => alias.trim()).filter(Boolean)),
  );
}

function priceRangeFilter(
  field: 'price' | 'discountPrice',
  constraints: ProductRetrievalConstraints,
) {
  const range: Record<string, number> = {};
  if (typeof constraints.minPrice === 'number')
    range.$gte = constraints.minPrice;
  if (typeof constraints.maxPrice === 'number')
    range.$lte = constraints.maxPrice;
  return { [field]: range };
}

function scoreRecord(
  record: ProductLexicalRecord,
  terms: string[],
): ProductCandidate | null {
  const fieldText = recordFieldText(record);
  const matchedTerms = new Set<string>();
  const matchedFields = new Set<string>();
  let lexicalScore = 0;

  for (const term of terms) {
    for (const [field, text] of Object.entries(fieldText)) {
      if (text.includes(term)) {
        matchedTerms.add(term);
        matchedFields.add(field);
        lexicalScore += FIELD_WEIGHTS[field] ?? 1;
      }
    }
  }

  if (matchedTerms.size === 0) return null;

  return {
    productId: String(record._id),
    score: 0,
    lexicalScore: roundScore(lexicalScore),
    matchedTerms: Array.from(matchedTerms),
    matchedFields: Array.from(matchedFields),
    source: 'lexical',
    payload: toPayload(record),
  };
}

function recordFieldText(record: ProductLexicalRecord): Record<string, string> {
  const metadata = record.searchMetadata ?? {};
  return {
    name: normalizeDictionaryText(record.name),
    category: normalizeDictionaryText(record.category),
    attributes: normalizeDictionaryText(
      JSON.stringify(record.attributes ?? {}),
    ),
    categoryPath: normalizeDictionaryText(
      (metadata.categoryPath ?? []).join(' '),
    ),
    normalizedSpecs: normalizeDictionaryText(
      JSON.stringify(metadata.normalizedSpecs ?? {}),
    ),
    semanticTags: normalizeDictionaryText(
      (metadata.semanticTags ?? []).join(' '),
    ),
    useCases: normalizeDictionaryText((metadata.useCases ?? []).join(' ')),
    targetUsers: normalizeDictionaryText(
      (metadata.targetUsers ?? []).join(' '),
    ),
  };
}

function toPayload(record: ProductLexicalRecord): ProductSearchPayload {
  const metadata = record.searchMetadata ?? {};
  return {
    productId: String(record._id),
    name: String(record.name ?? ''),
    slug: String(record.slug ?? record._id),
    category: String(record.category ?? ''),
    categoryPath: metadata.categoryPath ?? [],
    price: Number(record.price ?? 0),
    discountPrice: Number(record.discountPrice ?? 0),
    stock: Number(record.stock ?? 0),
    isPublished: record.isPublished !== false,
    isArchived: record.isArchived === true,
    semanticTags: metadata.semanticTags ?? [],
    useCases: metadata.useCases ?? [],
    targetUsers: metadata.targetUsers ?? [],
    normalizedSpecs: metadata.normalizedSpecs ?? {},
  };
}

function splitTerms(value: string): string[] {
  return normalizeDictionaryText(value)
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);
}

function uniqueTerms(terms: string[]): string[] {
  return Array.from(
    new Set(terms.map(normalizeDictionaryText).filter(Boolean)),
  );
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function roundScore(score: number): number {
  return Math.round(score * 1000) / 1000;
}
