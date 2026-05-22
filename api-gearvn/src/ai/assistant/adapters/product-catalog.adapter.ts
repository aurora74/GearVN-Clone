import { Injectable, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Product, ProductDocument } from '../../../product/product.schema';
import { Event, EventDocument } from '../../../event/event.schema';
import { getFlashSaleStatus } from '../../../event/helper/flash-sale-status';
import { ProductRetriever } from '../../retrieval/product-retriever';
import {
  extractHardConstraints,
  mergeRetrievalConstraints,
} from '../../retrieval/product-reranker';
import {
  ProductRetrievalConstraints,
  ProductRetrievalResult,
  RerankedProductCandidate,
} from '../../retrieval/product-retrieval.types';
import { AssistantProductDetail } from '../assistant.types';

export type ProductCatalogSnapshot = {
  productId: string;
  name: string;
  slug?: string;
  images?: string[];
  image?: string;
  price?: number;
  discountPrice?: number;
  stock?: number;
  category?: string;
  attributes?: Record<string, unknown>;
  searchMetadata?: Record<string, unknown>;
  isPublished?: boolean;
  isArchived?: boolean;
  event?: string;
};

type CatalogProductRecord = ProductCatalogSnapshot & { _id: unknown };
type CatalogEventRecord = {
  tag?: string;
  startsAt?: Date | string;
  endsAt?: Date | string;
  isEnabled?: boolean;
  isArchived?: boolean;
};
type CatalogProductDetailRecord = CatalogProductRecord & {
  description?: string;
  comments?: Array<Record<string, unknown>>;
  averageRating?: number;
  ratingsCount?: number;
};

const PRODUCT_LIST_PROJECTION =
  '_id name slug images price discountPrice stock category attributes searchMetadata isPublished isArchived event';
const PRODUCT_DETAIL_PROJECTION =
  '_id name slug price discountPrice stock category description attributes searchMetadata comments averageRating ratingsCount isPublished isArchived event';
@Injectable()
export class ProductCatalogAdapter {
  constructor(
    public readonly productRetriever: ProductRetriever,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @Optional()
    @InjectModel(Event.name)
    private readonly eventModel?: Model<EventDocument>,
  ) {}

  async searchProductsFast(
    query: string,
    options: { topK?: number } = {},
  ): Promise<ProductRetrievalResult> {
    const topK = options.topK ?? 5;
    const constraints = fastCatalogConstraints(query);
    const normalizedQuery = normalizeFastCatalogText(query);
    const terms = fastCatalogTerms(normalizedQuery);
    const products = await this.productModel
      .find(fastCatalogFilter(query, constraints))
      .select(PRODUCT_LIST_PROJECTION)
      .limit(Math.max(topK * 10, 50))
      .lean()
      .exec();
    const eventsByTag = await this.getEventsByTag(
      products.map((product) => (product as { event?: string }).event),
    );
    const results: RerankedProductCandidate[] = products
      .map((product) => {
        const record = normalizePromotionSnapshot(
          product as unknown as CatalogProductRecord,
          eventsByTag,
        );
        return {
          product: record,
          score: scoreFastCatalogProduct(
            record,
            normalizedQuery,
            terms,
            constraints,
          ),
        };
      })
      .sort((left, right) => {
        const scoreDelta = right.score - left.score;
        if (scoreDelta !== 0) return scoreDelta;
        return effectivePrice(left.product) - effectivePrice(right.product);
      })
      .map(({ product, score }, index) =>
        toRerankedCandidate(product, index, score),
      )
      .slice(0, topK);

    return {
      query: {
        original: query,
        expanded: [query],
        expandedText: query,
        constraints,
      },
      candidates: results,
      lexicalCandidates: results,
      results,
      effectiveQuery: query,
    };
  }

  async searchProducts(
    query: string,
    options: { topK?: number } = {},
  ): Promise<ProductRetrievalResult> {
    return this.productRetriever.search(query, options);
  }

  async getSnapshotsByIds(
    productIds: string[],
  ): Promise<ProductCatalogSnapshot[]> {
    const ids = productIds.filter((id) => Types.ObjectId.isValid(id));
    if (ids.length === 0) return [];

    const products = await this.productModel
      .find(visibleProductFilter({ _id: { $in: ids } }))
      .select(PRODUCT_LIST_PROJECTION)
      .lean()
      .exec();
    const eventsByTag = await this.getEventsByTag(
      products.map((product) => (product as { event?: string }).event),
    );

    const byId = new Map<string, ProductCatalogSnapshot>(
      products.map((product) => {
        const snapshot = toCatalogSnapshot(
          normalizePromotionSnapshot(
            product as unknown as CatalogProductRecord,
            eventsByTag,
          ),
        );
        return [snapshot.productId, snapshot] as const;
      }),
    );

    return productIds
      .map((productId) => byId.get(productId))
      .filter((snapshot): snapshot is ProductCatalogSnapshot =>
        Boolean(snapshot),
      );
  }

  async getProductDetailById(
    productId: string,
  ): Promise<AssistantProductDetail | null> {
    if (!Types.ObjectId.isValid(productId)) return null;

    const product = await this.productModel
      .findOne(visibleProductFilter({ _id: productId }))
      .select(PRODUCT_DETAIL_PROJECTION)
      .lean()
      .exec();

    if (!product) return null;
    const eventsByTag = await this.getEventsByTag([
      (product as { event?: string }).event,
    ]);

    return product
      ? toProductDetail(
          normalizePromotionSnapshot(
            product as unknown as CatalogProductDetailRecord,
            eventsByTag,
          ) as CatalogProductDetailRecord,
        )
      : null;
  }

  async findProductDetailsByNameOrSlug(
    query: string,
    limit = 5,
  ): Promise<AssistantProductDetail[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const escapedQuery = escapeRegex(trimmed);
    const normalizedQuery = normalizeFastCatalogText(trimmed);
    const queryRegex = new RegExp(escapedQuery, 'i');
    const normalizedRegex = new RegExp(escapeRegex(normalizedQuery), 'i');
    const boundedLimit = Math.min(Math.max(Math.floor(limit), 1), 10);

    const products = await this.productModel
      .find(
        visibleProductFilter({
          $or: [
            { name: queryRegex },
            { slug: queryRegex },
            { 'searchMetadata.normalizedName': normalizedRegex },
          ],
        }),
      )
      .select(PRODUCT_DETAIL_PROJECTION)
      .limit(boundedLimit)
      .lean()
      .exec();

    const eventsByTag = await this.getEventsByTag(
      products.map((product) => (product as { event?: string }).event),
    );

    return products.map((product) =>
      toProductDetail(
        normalizePromotionSnapshot(
          product as unknown as CatalogProductDetailRecord,
          eventsByTag,
        ) as CatalogProductDetailRecord,
      ),
    );
  }

  private async getEventsByTag(
    tags: Array<string | undefined>,
  ): Promise<Map<string, CatalogEventRecord>> {
    if (!this.eventModel) return new Map();
    const uniqueTags = Array.from(
      new Set(tags.map((tag) => tag?.trim()).filter(Boolean) as string[]),
    );
    if (uniqueTags.length === 0) return new Map();

    const events = await this.eventModel
      .find({ tag: { $in: uniqueTags }, isArchived: { $ne: true } })
      .select('tag startsAt endsAt isEnabled isArchived')
      .lean()
      .exec();

    return new Map(
      events
        .map((event) => event as unknown as CatalogEventRecord)
        .filter((event) => event.tag)
        .map((event) => [String(event.tag), event] as const),
    );
  }
}

export function orderedProductIds(
  results: RerankedProductCandidate[],
  limit: number,
): string[] {
  const ids: string[] = [];
  for (const result of results) {
    const productId = result.productId || result.payload.productId;
    if (productId && !ids.includes(productId)) ids.push(productId);
    if (ids.length >= limit) break;
  }
  return ids;
}

function toCatalogSnapshot(
  product: CatalogProductRecord,
): ProductCatalogSnapshot {
  const images = Array.isArray(product.images)
    ? product.images.filter((image): image is string =>
        typeof image === 'string' && image.trim().length > 0,
      )
    : [];

  return {
    productId: String(product._id),
    name: product.name,
    slug: product.slug,
    images,
    image: images[0],
    price: product.price,
    discountPrice: product.discountPrice,
    stock: product.stock,
    category: product.category,
    attributes: product.attributes,
    searchMetadata: product.searchMetadata,
    isPublished: product.isPublished,
    isArchived: product.isArchived,
    event: product.event,
  };
}

function toProductDetail(
  product: CatalogProductDetailRecord,
): AssistantProductDetail {
  return {
    productId: String(product._id),
    name: product.name,
    slug: product.slug,
    price: product.price,
    discountPrice: product.discountPrice,
    stock: product.stock,
    category: product.category,
    description: product.description,
    attributes: product.attributes,
    searchMetadata: product.searchMetadata,
    averageRating: product.averageRating,
    ratingsCount: product.ratingsCount,
    reviewSignals: buildReviewSignals(product.comments),
    specsSummary: asString(product.searchMetadata?.specsSummary),
  };
}

function normalizePromotionSnapshot<T extends CatalogProductRecord>(
  product: T,
  eventsByTag: Map<string, CatalogEventRecord>,
): T {
  if (hasActivePromotion(product, eventsByTag)) return product;
  return { ...product, discountPrice: undefined };
}

function hasActivePromotion(
  product: CatalogProductRecord,
  eventsByTag: Map<string, CatalogEventRecord>,
): boolean {
  const eventTag = product.event?.trim();
  if (!eventTag) return false;
  const event = eventsByTag.get(eventTag);
  if (!event || event.isArchived === true) return false;
  if (getFlashSaleStatus(event) !== 'active') return false;
  if (product.isPublished === false || product.isArchived === true) return false;
  if (Number(product.stock ?? 0) <= 0) return false;
  const discountPrice = Number(product.discountPrice ?? 0);
  return Number.isFinite(discountPrice) && discountPrice > 0;
}

function visibleProductFilter(extra: Record<string, unknown>) {
  return {
    ...extra,
    isPublished: true,
    isArchived: { $ne: true },
  };
}

function buildReviewSignals(comments?: Array<Record<string, unknown>>) {
  const visibleReviews = (comments ?? []).filter(
    (comment) => comment.moderationStatus !== 'hidden' && comment.moderationStatus !== 'deleted',
  );
  return {
    visibleReviewCount: visibleReviews.length,
    latestVisibleReviewAt: visibleReviews
      .map((comment) => comment.createdAt)
      .filter(Boolean)
      .map(String)[0],
  };
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
function fastCatalogConstraints(query: string): ProductRetrievalConstraints {
  return mergeRetrievalConstraints(extractHardConstraints(query), {
    inStockOnly: true,
  });
}

function fastCatalogFilter(
  query: string,
  constraints: ProductRetrievalConstraints,
) {
  const normalized = normalizeFastCatalogText(query);
  const terms = fastCatalogTerms(normalized)
    .filter((term) => term !== constraints.category)
    .slice(0, 4);
  const useTextFilter = terms.length > 0 && typeof constraints.maxPrice !== 'number';
  const regexes = useTextFilter
    ? terms.map((term) => new RegExp(escapeRegex(term), 'i'))
    : [];
  const searchFields = [
    'name',
    'category',
    'searchMetadata.categoryPath',
    'searchMetadata.searchText',
    'searchMetadata.semanticTags',
    'searchMetadata.useCases',
    'searchMetadata.targetUsers',
  ];
  const filter: Record<string, unknown> = {
    isPublished: true,
    isArchived: { $ne: true },
    stock: { $gt: 0 },
  };

  const andFilters: Array<Record<string, unknown>> = [];
  if (hasFastCatalogCategoryConstraint(constraints, 'laptop')) {
    andFilters.push({
      $or: [
        { name: /laptop/i },
        { category: /laptop/i },
        { 'searchMetadata.categoryPath': /laptop/i },
      ],
    });
  }
  if (regexes.length > 0) {
    andFilters.push({
      $or: searchFields.flatMap((field) =>
        regexes.map((regex) => ({ [field]: regex })),
      ),
    });
  }
  if (typeof constraints.maxPrice === 'number') {
    andFilters.push({
      $or: [
        { discountPrice: { $gt: 0, $lte: constraints.maxPrice } },
        { price: { $lte: constraints.maxPrice } },
      ],
    });
  }
  if (andFilters.length > 0) filter.$and = andFilters;
  return filter;
}

function hasFastCatalogCategoryConstraint(
  constraints: ProductRetrievalConstraints,
  category: string,
): boolean {
  const normalizedCategory = normalizeFastCatalogText(category);
  return [
    constraints.category,
    ...(constraints.categoryHints ?? []),
    ...(constraints.categoryPath ?? []),
  ].some(
    (value) =>
      typeof value === 'string' &&
      normalizeFastCatalogText(value).includes(normalizedCategory),
  );
}

const FAST_CATALOG_STOP_WORDS = new Set([
  'ban',
  'banh',
  'co',
  'duoi',
  'dung',
  'hoc',
  'hieu',
  'khong',
  'ko',
  'learning',
  'machine',
  'nao',
  'ngan',
  'nang',
  'sach',
  'tien',
  'trieu',
]);

function normalizeFastCatalogText(query: string): string {
  return query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\blaptp\b/g, 'laptop')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


function fastCatalogTerms(normalized: string): string[] {
  return normalized
    .split(/\s+/)
    .filter(
      (term) =>
        term.length >= 3 &&
        /[a-z]/.test(term) &&
        !FAST_CATALOG_STOP_WORDS.has(term),
    );
}

function scoreFastCatalogProduct(
  product: CatalogProductRecord,
  normalizedQuery: string,
  terms: string[],
  constraints: ProductRetrievalConstraints,
): number {
  const text = normalizeFastCatalogText(fastCatalogSearchText(product));
  let score = 0;

  if (normalizedQuery && text.includes(normalizedQuery)) score += 50;
  for (const term of terms) {
    if (text.includes(term)) score += term.length >= 5 ? 6 : 3;
  }
  if (constraints.category === 'laptop' && /\blaptop\b/.test(text)) score += 10;
  if (isPerformanceLaptopIntent(normalizedQuery) && hasPerformanceLaptopSignals(text)) {
    score += 14;
  }
  if (typeof constraints.maxPrice === 'number') {
    const price = effectivePrice(product);
    if (price > 0 && price <= constraints.maxPrice) {
      score += 8 + Math.max(0, 1 - price / constraints.maxPrice);
    }
  }
  if (Number(product.stock ?? 0) > 0) score += 2;

  return score;
}
function isPerformanceLaptopIntent(normalizedQuery: string): boolean {
  return /machine learning|\bai\b|hieu nang|gpu|rtx|render|lap trinh|code/.test(
    normalizedQuery,
  );
}

function hasPerformanceLaptopSignals(text: string): boolean {
  return /rtx|gtx|nvidia|gpu|core i7|core i9|ryzen 7|ryzen 9|ultra 7|ultra 9|4060|4070|5060|5070/.test(
    text,
  );
}

function fastCatalogSearchText(product: CatalogProductRecord): string {
  const searchMetadata = product.searchMetadata ?? {};
  return [
    product.name,
    product.slug,
    product.category,
    product.attributes ? JSON.stringify(product.attributes) : '',
    searchMetadata.searchText,
    searchMetadata.categoryPath,
    searchMetadata.semanticTags,
    searchMetadata.useCases,
    searchMetadata.targetUsers,
    searchMetadata.normalizedSpecs
      ? JSON.stringify(searchMetadata.normalizedSpecs)
      : '',
  ]
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value): value is string => typeof value === 'string')
    .join(' ');
}

function effectivePrice(product: CatalogProductRecord): number {
  const discountPrice = Number(product.discountPrice ?? 0);
  return discountPrice > 0 ? discountPrice : Number(product.price ?? 0);
}

function toRerankedCandidate(
  product: CatalogProductRecord,
  index: number,
  score = 0.8 - index * 0.01,
): RerankedProductCandidate {
  const snapshot = toCatalogSnapshot(product);
  const payload = {
    productId: snapshot.productId,
    name: snapshot.name,
    slug: snapshot.slug ?? snapshot.productId,
    category: snapshot.category ?? '',
    categoryPath: Array.isArray(snapshot.searchMetadata?.categoryPath)
      ? snapshot.searchMetadata.categoryPath
      : [],
    price: Number(snapshot.price ?? 0),
    discountPrice: Number(snapshot.discountPrice ?? 0),
    stock: Number(snapshot.stock ?? 0),
    isPublished: snapshot.isPublished !== false,
    isArchived: snapshot.isArchived === true,
    semanticTags: asStringArray(snapshot.searchMetadata?.semanticTags),
    useCases: asStringArray(snapshot.searchMetadata?.useCases),
    targetUsers: asStringArray(snapshot.searchMetadata?.targetUsers),
    normalizedSpecs: isRecord(snapshot.searchMetadata?.normalizedSpecs)
      ? snapshot.searchMetadata.normalizedSpecs
      : {},
  };

  return {
    productId: snapshot.productId,
    score,
    lexicalScore: score,
    source: 'lexical',
    payload,
    rerankScore: Math.max(1, Math.round(score * 10)),
    reasons: [
      {
        code: 'keyword_match',
        message: 'Khớp nhanh với danh mục, ngân sách và tình trạng còn hàng.',
        weight: 10,
      },
    ],
  };
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
