import { createHash } from 'node:crypto';
import { Injectable, Optional } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import {
  AiRetrievalConfig,
  readAiRetrievalConfig,
} from '../config/ai-retrieval.config';
import {
  ProductCandidate,
  ProductRetrievalFilter,
  ProductSearchPayload,
} from '../retrieval/product-retrieval.types';

const DEFAULT_COLLECTION = 'products';
const FORBIDDEN_PAYLOAD_KEYS = new Set([
  'raw',
  'rawCrawl',
  'crawlSnapshot',
  'description',
]);

const PAYLOAD_INDEXES = [
  ['productId', 'keyword'],
  ['category', 'keyword'],
  ['categoryPath', 'keyword'],
  ['isPublished', 'bool'],
  ['stock', 'integer'],
  ['isArchived', 'bool'],
  ['price', 'integer'],
] as const;

type QdrantScrollResponse = {
  points?: Array<{ payload?: ProductSearchPayload }>;
  next_page_offset?: unknown;
  nextPageOffset?: unknown;
};

type QdrantLikeClient = {
  getCollection(collectionName: string): Promise<unknown>;
  createCollection(collectionName: string, body: unknown): Promise<unknown>;
  recreateCollection(collectionName: string, body: unknown): Promise<unknown>;
  createPayloadIndex(collectionName: string, body: unknown): Promise<unknown>;
  upsert(collectionName: string, body: unknown): Promise<unknown>;
  query(collectionName: string, body: unknown): Promise<unknown>;
  scroll(collectionName: string, body: unknown): Promise<QdrantScrollResponse>;
  count(collectionName: string, body: unknown): Promise<{ count: number }>;
};

type QdrantProductsClientOptions = {
  config?: AiRetrievalConfig;
  qdrant?: QdrantLikeClient;
};

export type ProductVectorPoint = {
  productId: string;
  vector: number[];
  payload: ProductSearchPayload;
};

@Injectable()
export class QdrantProductsClient {
  private readonly config: AiRetrievalConfig;
  private readonly qdrant: QdrantLikeClient;
  private readonly collection: string;

  constructor(@Optional() options: QdrantProductsClientOptions = {}) {
    this.config = options.config ?? readAiRetrievalConfig();
    this.collection = this.config.qdrant.collection || DEFAULT_COLLECTION;
    this.qdrant = options.qdrant ?? this.createQdrantClient();
  }

  async ensureCollection(vectorSize: number): Promise<void> {
    const existing = await this.getExistingCollection();

    if (!existing) {
      await this.qdrant.createCollection(this.collection, {
        vectors: { size: vectorSize, distance: 'Cosine' },
      });
    } else {
      this.validateCollection(existing, vectorSize);
    }

    await this.ensurePayloadIndexes();
  }

  async recreateCollection(vectorSize: number): Promise<void> {
    await this.qdrant.recreateCollection(this.collection, {
      vectors: { size: vectorSize, distance: 'Cosine' },
    });
    await this.ensurePayloadIndexes();
  }

  async upsertProducts(
    points: ProductVectorPoint[],
    options: { wait?: boolean } = {},
  ): Promise<void> {
    for (const point of points) {
      this.validatePayload(point.payload);
    }

    await this.qdrant.upsert(this.collection, {
      wait: options.wait ?? true,
      points: points.map((point) => ({
        id: qdrantPointId(point.productId),
        vector: point.vector,
        payload: point.payload,
      })),
    });
  }

  async queryProducts(
    vector: number[],
    options: { limit?: number; filters?: ProductRetrievalFilter } = {},
  ): Promise<ProductCandidate[]> {
    const queryBody = {
      query: vector,
      filter: buildFilter(options.filters),
      limit: options.limit ?? 10,
      with_payload: true,
      with_vector: false,
    };

    let response: unknown;
    try {
      response = await this.qdrant.query(this.collection, queryBody);
    } catch (error) {
      if (!isMissingPayloadIndexError(error)) {
        throw error;
      }

      await this.ensurePayloadIndexes();
      response = await this.qdrant.query(this.collection, queryBody);
    }

    return normalizeQueryPoints(response).map((point) => ({
      productId: String(point.payload.productId ?? point.id),
      score: point.score,
      payload: point.payload,
    }));
  }

  async countProducts(): Promise<number> {
    const response = await this.qdrant.count(this.collection, { exact: true });
    return response.count;
  }

  async listProductPayloads(
    options: { batchSize?: number } = {},
  ): Promise<ProductSearchPayload[]> {
    const payloads: ProductSearchPayload[] = [];
    let offset: unknown;

    do {
      const body: Record<string, unknown> = {
        limit: options.batchSize ?? 256,
        with_payload: true,
        with_vector: false,
      };
      if (offset !== undefined && offset !== null) body.offset = offset;

      const response = normalizeScrollResponse(
        await this.qdrant.scroll(this.collection, body),
      );
      for (const point of response.points) {
        const payload = point.payload;
        if (isProductSearchPayload(payload)) payloads.push(payload);
      }
      offset = response.nextPageOffset;
    } while (offset !== undefined && offset !== null);

    return payloads;
  }

  async listProductPayloadIds(
    options: { batchSize?: number } = {},
  ): Promise<string[]> {
    const payloads = await this.listProductPayloads(options);
    return Array.from(
      new Set(payloads.map((payload) => payload.productId)),
    ).sort((left, right) => left.localeCompare(right));
  }

  validatePayload(payload: ProductSearchPayload): void {
    for (const key of Object.keys(payload)) {
      if (FORBIDDEN_PAYLOAD_KEYS.has(key)) {
        throw new Error(
          `Qdrant product payload includes forbidden key: ${key}`,
        );
      }
    }
  }

  private createQdrantClient(): QdrantLikeClient {
    const missing = [
      ['QDRANT_URL', this.config.qdrant.url],
      ['QDRANT_API_KEY', this.config.qdrant.apiKey],
    ]
      .filter(([, value]) => !value)
      .map(([name]) => name);

    if (missing.length > 0) {
      throw new Error(`Missing AI retrieval env vars: ${missing.join(', ')}`);
    }

    return new QdrantClient({
      url: this.config.qdrant.url,
      apiKey: this.config.qdrant.apiKey,
    }) as QdrantLikeClient;
  }

  private async getExistingCollection(): Promise<object | null> {
    try {
      return (await this.qdrant.getCollection(this.collection)) as object;
    } catch (error) {
      if (isNotFoundError(error)) return null;
      throw error;
    }
  }

  private validateCollection(collection: unknown, vectorSize: number): void {
    const vectors = readVectorsConfig(collection);
    if (!vectors) {
      throw new Error(
        `Qdrant collection ${this.collection} vector config missing`,
      );
    }

    if (vectors.size !== vectorSize) {
      throw new Error(
        `Qdrant collection ${this.collection} vector size mismatch: expected ${vectorSize}, found ${vectors.size}`,
      );
    }

    if (vectors.distance !== 'Cosine') {
      throw new Error(
        `Qdrant collection ${this.collection} distance mismatch: expected Cosine, found ${vectors.distance}`,
      );
    }
  }

  private async ensurePayloadIndexes(): Promise<void> {
    for (const [fieldName, fieldSchema] of PAYLOAD_INDEXES) {
      await this.qdrant.createPayloadIndex(this.collection, {
        field_name: fieldName,
        field_schema: fieldSchema,
        wait: true,
      });
    }
  }
}

function qdrantPointId(productId: string): string {
  const bytes = createHash('sha256').update(productId).digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.subarray(0, 16).toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

function buildFilter(filters: ProductRetrievalFilter = {}) {
  const must: unknown[] = [];
  const mustNot: unknown[] = [{ key: 'isArchived', match: { value: true } }];

  if (filters.category) {
    must.push({ key: 'category', match: { value: filters.category } });
  }
  if (filters.categoryPath?.length) {
    must.push({ key: 'categoryPath', match: { any: filters.categoryPath } });
  }
  if (typeof filters.minPrice === 'number') {
    must.push({ key: 'price', range: { gte: filters.minPrice } });
  }
  if (typeof filters.maxPrice === 'number') {
    must.push({ key: 'price', range: { lte: filters.maxPrice } });
  }
  if (filters.inStockOnly) {
    must.push({ key: 'stock', range: { gt: 0 } });
  }
  if (filters.semanticTags?.length) {
    must.push({ key: 'semanticTags', match: { any: filters.semanticTags } });
  }
  if (filters.useCases?.length) {
    must.push({ key: 'useCases', match: { any: filters.useCases } });
  }
  if (filters.targetUsers?.length) {
    must.push({ key: 'targetUsers', match: { any: filters.targetUsers } });
  }

  must.push({ key: 'isPublished', match: { value: true } });

  return {
    must,
    must_not: mustNot,
  };
}

function normalizeQueryPoints(response: unknown): Array<{
  id: unknown;
  score: number;
  payload: ProductSearchPayload;
}> {
  const points =
    response && typeof response === 'object' && 'points' in response
      ? (response as { points?: unknown }).points
      : response;

  if (!Array.isArray(points)) return [];

  return points
    .filter(
      (
        point,
      ): point is {
        id: unknown;
        score: number;
        payload: ProductSearchPayload;
      } => {
        return (
          Boolean(point) &&
          typeof point === 'object' &&
          'payload' in point &&
          typeof (point as { score?: unknown }).score === 'number'
        );
      },
    )
    .map((point) => point);
}

function normalizeScrollResponse(response: unknown): {
  points: Array<{ payload?: ProductSearchPayload }>;
  nextPageOffset?: unknown;
} {
  if (!response || typeof response !== 'object') return { points: [] };
  const body = response as QdrantScrollResponse;
  return {
    points: Array.isArray(body.points) ? body.points : [],
    nextPageOffset: body.next_page_offset ?? body.nextPageOffset,
  };
}

function isProductSearchPayload(
  payload: unknown,
): payload is ProductSearchPayload {
  return Boolean(
    payload &&
      typeof payload === 'object' &&
      typeof (payload as { productId?: unknown }).productId === 'string',
  );
}

function readVectorsConfig(
  collection: unknown,
): { size: number; distance: string } | null {
  if (!collection || typeof collection !== 'object') return null;
  const params = (collection as { config?: { params?: { vectors?: unknown } } })
    .config?.params;
  const vectors = params?.vectors;
  if (
    !vectors ||
    typeof vectors !== 'object' ||
    !('size' in vectors) ||
    !('distance' in vectors)
  ) {
    return null;
  }
  return vectors as { size: number; distance: string };
}

function isMissingPayloadIndexError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if (Number((error as { status?: unknown }).status) !== 400) return false;

  const data =
    (error as { data?: unknown; response?: { data?: unknown } }).data ??
    (error as { response?: { data?: unknown } }).response?.data;
  const message = JSON.stringify(data ?? error).toLowerCase();
  return message.includes('index required but not found');
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('status' in error)) {
    return false;
  }
  return Number((error as { status: unknown }).status) === 404;
}
