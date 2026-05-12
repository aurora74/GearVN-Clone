import {
  AssistantIntent,
  AssistantProductCard,
  AssistantProductDetail,
  AssistantResolvedProductContext,
} from '../assistant.types';
import { ProductCatalogAdapter } from '../adapters/product-catalog.adapter';

export { ProductCatalogAdapter } from '../adapters/product-catalog.adapter';

type ProductDetailState = {
  roomId?: string;
  userText: string;
  productId?: string;
  productContext?: Partial<AssistantResolvedProductContext> & {
    productId?: string;
  };
  metadata?: Record<string, unknown>;
};

type ProductDetailConfig = {
  catalogAdapter: Pick<ProductCatalogAdapter, 'getProductDetailById'>;
  abortSignal?: AbortSignal;
  reviewSearchClient?: unknown;
  sessionService?: {
    saveRecommendationLedger?: (
      roomId: string,
      cards: AssistantProductCard[],
    ) => Promise<unknown>;
  };
  roomId?: string;
};

export async function productDetailNode(
  state: ProductDetailState,
  config: ProductDetailConfig,
): Promise<any> {
  const startedAt = Date.now();
  const productId = resolveProductId(state);

  if (!productId) {
    return fallbackResponse(
      'Mình chưa xác định được sản phẩm bạn muốn xem chi tiết. Bạn nói rõ tên hoặc số thứ tự sản phẩm giúp mình nhé.',
      'missing_product_context',
      startedAt,
      [],
    );
  }

  throwIfAborted(config.abortSignal);
  const detail = await config.catalogAdapter.getProductDetailById(productId);
  throwIfAborted(config.abortSignal);

  if (!detail) {
    return fallbackResponse(
      'Mình chưa tìm thấy chi tiết sản phẩm này trong catalog hiện tại. Bạn gửi lại tên đầy đủ hoặc chọn sản phẩm khác giúp mình nhé.',
      'catalog_detail_not_found',
      startedAt,
      [productId],
    );
  }

  const productCard = toProductCard(detail);
  const roomId = config.roomId ?? state.roomId;
  if (roomId) {
    await config.sessionService?.saveRecommendationLedger?.(roomId, [productCard]);
    throwIfAborted(config.abortSignal);
  }
  const latencyMs = Date.now() - startedAt;

  return {
    intent: AssistantIntent.REVIEW_SUMMARY,
    nodeName: 'product_detail',
    text: buildProductDetailText(detail),
    metadata: {
      productDetail: detail,
      productCards: [productCard],
      productIds: [detail.productId],
      tool_calls: [
        {
          toolName: 'ProductCatalogAdapter.getProductDetailById',
          subgraph: 'sales',
          status: 'success',
          latencyMs,
          inputSummary: detail.productId,
          outputSummary: detail.name,
        },
      ],
      node: 'product_detail',
      active_subgraph: 'sales',
      catalog_detail_latency_ms: latencyMs,
    },
  };
}

function fallbackResponse(
  text: string,
  fallbackReason: string,
  startedAt: number,
  productIds: string[],
) {
  const latencyMs = Date.now() - startedAt;
  return {
    intent: AssistantIntent.REVIEW_SUMMARY,
    nodeName: 'product_detail',
    text,
    metadata: {
      productIds,
      tool_calls: [
        {
          toolName: 'ProductCatalogAdapter.getProductDetailById',
          subgraph: 'sales',
          status: 'skipped',
          latencyMs,
          inputSummary: productIds[0] ?? 'no product id',
          outputSummary: fallbackReason,
        },
      ],
      node: 'product_detail',
      active_subgraph: 'sales',
      catalog_detail_latency_ms: latencyMs,
      fallback_reason: fallbackReason,
    },
  };
}

function resolveProductId(state: ProductDetailState): string | undefined {
  if (state.productId) return state.productId;
  const productContext =
    state.productContext ??
    (state.metadata?.productContext as ProductDetailState['productContext']);
  if (productContext?.productId) return productContext.productId;
  const product = productContext?.product;
  return product?.productId;
}

function toProductCard(detail: AssistantProductDetail): AssistantProductCard {
  const effectivePrice = detail.discountPrice ?? detail.price;
  return {
    productId: detail.productId,
    name: detail.name,
    slug: detail.slug,
    detailHref: detail.slug
      ? `/products/${detail.slug}`
      : `/products/${detail.productId}`,
    price: detail.price,
    discountPrice: detail.discountPrice,
    stock: detail.stock,
    reasons: buildReasons(detail),
    availability: {
      status:
        typeof detail.stock === 'number' && detail.stock <= 0
          ? 'out_of_stock'
          : 'available',
      addable: typeof detail.stock !== 'number' || detail.stock > 0,
    },
    actionPayload: {
      productId: detail.productId,
      actions: ['view_detail', ...(effectivePrice ? ['add_to_cart'] : [])],
    },
    specs: detail.attributes ?? {},
  };
}

function buildReasons(detail: AssistantProductDetail): string[] {
  const reasons = [
    detail.category ? `Danh mục: ${detail.category}` : undefined,
    detail.specsSummary ?? asString(detail.searchMetadata?.specsSummary),
    typeof detail.averageRating === 'number'
      ? `Đánh giá catalog: ${detail.averageRating}/5`
      : undefined,
  ].filter((reason): reason is string => Boolean(reason));

  return reasons.length > 0 ? reasons : ['Thông tin lấy từ catalog sản phẩm.'];
}

function buildProductDetailText(detail: AssistantProductDetail): string {
  const lines = [
    `Mình xem theo dữ liệu catalog hiện tại của ${detail.name}.`,
    detail.category ? `Danh mục: ${detail.category}.` : undefined,
    priceLine(detail),
    typeof detail.stock === 'number'
      ? `Tồn kho catalog: ${detail.stock} sản phẩm.`
      : undefined,
    detail.description ? `Mô tả: ${detail.description}` : undefined,
    detail.specsSummary ?? asString(detail.searchMetadata?.specsSummary)
      ? `Thông số nổi bật: ${
          detail.specsSummary ?? asString(detail.searchMetadata?.specsSummary)
        }.`
      : undefined,
    attributesLine(detail.attributes),
    ratingLine(detail),
    missingFactLine('warranty'),
    missingFactLine('promotion'),
    missingFactLine('benchmark'),
    missingFactLine('public-review'),
  ].filter((line): line is string => Boolean(line));

  return lines.join('\n');
}

function priceLine(detail: AssistantProductDetail): string | undefined {
  if (typeof detail.discountPrice === 'number' && detail.discountPrice > 0) {
    return `Giá catalog: ${formatCurrency(detail.discountPrice)}${
      typeof detail.price === 'number'
        ? ` (giá gốc ${formatCurrency(detail.price)})`
        : ''
    }.`;
  }
  return typeof detail.price === 'number'
    ? `Giá catalog: ${formatCurrency(detail.price)}.`
    : undefined;
}

function attributesLine(
  attributes: AssistantProductDetail['attributes'],
): string | undefined {
  if (!attributes || Object.keys(attributes).length === 0) return undefined;
  const facts = Object.entries(attributes)
    .slice(0, 6)
    .map(([key, value]) => `${key}: ${String(value)}`);
  return `Thuộc tính catalog: ${facts.join(', ')}.`;
}

function ratingLine(detail: AssistantProductDetail): string | undefined {
  if (typeof detail.averageRating !== 'number') return undefined;
  return `Điểm đánh giá nội bộ: ${detail.averageRating}/5${
    typeof detail.ratingsCount === 'number'
      ? ` từ ${detail.ratingsCount} lượt`
      : ''
  }.`;
}

function missingFactLine(label: string): string {
  return `${label}: không có trong dữ liệu catalog hiện tại.`;
}

function formatCurrency(value: number): string {
  return `${Math.round(value).toLocaleString('vi-VN')}đ`;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error('productDetailNode aborted');
}
