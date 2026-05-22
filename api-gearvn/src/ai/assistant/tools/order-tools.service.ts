import { Injectable, Optional } from '@nestjs/common';

import {
  AssistantRecommendationLedgerEntry,
  AssistantToolCallTrace,
} from '../assistant.types';
import { AssistantSessionService } from '../assistant-session.service';
import { ShoppingAssistantStateType } from '../shopping-assistant.state';
import {
  AssistantActionAdapter,
  AssistantCartAction,
  AssistantCheckoutFields,
  AssistantProductSnapshot,
} from '../adapters/assistant-action.adapter';
import { ProductCatalogAdapter, ProductCatalogSnapshot } from '../adapters/product-catalog.adapter';
import { VoucherAdapter } from '../adapters/voucher.adapter';
import { OrderLookupAdapter } from '../adapters/order.adapter';
import { CustomerAssistantProfileService } from '../memory/customer-assistant-profile.service';
import {
  extractRecommendationReference,
  isOrdinalOnlyReference,
  isOrdinalRecommendationReference,
} from '../resolvers/recommendation-reference.util';
const CHECKOUT_REDIRECT_PATH = '/cart?step=payment';

export type OrderToolResult<T = unknown> = {
  data: T;
  toolCall: AssistantToolCallTrace;
};

type ResolvedOrderProduct =
  | AssistantRecommendationLedgerEntry
  | AssistantProductSnapshot;

@Injectable()
export class OrderToolsService {
  constructor(
    private readonly sessionService: AssistantSessionService,
    @Optional() private readonly actionAdapter?: AssistantActionAdapter,
    @Optional() private readonly voucherAdapter?: VoucherAdapter,
    @Optional() private readonly orderLookupAdapter?: OrderLookupAdapter,
    @Optional() private readonly customerProfileService?: CustomerAssistantProfileService,
    @Optional() private readonly catalogAdapter?: ProductCatalogAdapter,
  ) {}

  async resolveProductReference(
    state: ShoppingAssistantStateType,
  ): Promise<OrderToolResult<ResolvedOrderProduct | null>> {
    const startedAt = Date.now();
    const reference = extractReference(state);
    let productName = extractProductName(state);
    let resolved: ResolvedOrderProduct | null = null;
    let ledger: AssistantRecommendationLedgerEntry[] | null = null;

    if (reference) {
      resolved = await this.sessionService.resolveRecommendationReference(
        state.roomId,
        reference,
      );
    }

    if (!resolved && wantsCheaperInStock(state)) {
      ledger = await this.sessionService.getLastRecommendationLedger(state.roomId);
      resolved = selectCheapestInStock(ledger);
    }

    if (!resolved && reference && isOrdinalRecommendationReference(String(reference))) {
      productName = undefined;
    }

    if (!resolved && productName) {
      resolved = await this.resolveProductByName(productName);
    }

    if (!resolved && shouldUseFocusedLedgerProduct(state, reference, productName)) {
      ledger = ledger ?? (await this.sessionService.getLastRecommendationLedger(state.roomId));
      resolved = selectFocusedLedgerProduct(ledger);
    }

    return {
      data: resolved,
      toolCall: toolCall(
        'resolve_recommendation_reference',
        resolved ? 'success' : 'skipped',
        startedAt,
        reference
          ? `reference:${reference}`
          : productName
            ? `productName:${productName}`
            : shouldUseFocusedLedgerProduct(state, reference, productName)
              ? 'focused-ledger-selection'
              : 'deterministic-ledger-selection',
        resolved ? productSummary(resolved) : 'unresolved',
      ),
    };
  }

  async createCartActionDraft(
    state: ShoppingAssistantStateType,
    product: AssistantRecommendationLedgerEntry | AssistantProductSnapshot,
    quantity = 1,
    action: AssistantCartAction = 'CART_ADD',
  ): Promise<OrderToolResult<unknown>> {
    const startedAt = Date.now();
    const snapshot = await this.resolveProductSnapshot(product);
    if (!snapshot) {
      return {
        data: { type: 'clarification', reason: 'unresolved_product' },
        toolCall: toolCall(
          'create_cart_action_draft',
          'skipped',
          startedAt,
          `product:${'productId' in product ? product.productId : product.id}`,
          'unresolved_product',
        ),
      };
    }

    const draft = await this.requireActionAdapter().createDraft({
      roomId: state.roomId,
      customerId: ownerId(state),
      action,
      displayText: cartActionDisplay(action),
      product: snapshot,
      productId: snapshot.id,
      quantity,
      confirmedByBackend: false,
    });

    return {
      data: {
        type: 'assistant_action_draft',
        draft,
      },
      toolCall: toolCall(
        'create_cart_action_draft',
        'success',
        startedAt,
        `product:${snapshot.id};quantity:${quantity}`,
        `draft:${draft.draftId}`,
      ),
    };
  }

  async prepareCheckoutReview(state: ShoppingAssistantStateType) {
    const checkout = await this.extractCheckoutFieldsWithProfile(state);
    const missingFields = missingCheckoutFields(checkout);
    const voucherCode = await this.resolveCheckoutVoucherCode(state);
    const checkoutReview = {
      name: checkout.name,
      phoneMasked: maskPhone(checkout.phone),
      addressPreview: previewAddress(checkout.address),
      voucherCode,
      missingFields,
      actions: ['Đúng rồi', 'Chỉnh sửa'],
    };

    if (missingFields.length > 0 || !isCheckoutReviewAccepted(state)) {
      return {
        type: 'checkout_review',
        text: missingFields.length
          ? 'Mình cần bạn bổ sung đủ tên, số điện thoại và địa chỉ trước khi chuẩn bị thanh toán.'
          : 'Bạn kiểm tra lại tên, số điện thoại và địa chỉ giao hàng trước khi mình chuyển sang bước thanh toán nhé.',
        metadata: {
          checkoutReview,
          checkoutReviewActions: ['Đúng rồi', 'Chỉnh sửa'],
          voucherCode,
          redirectPath: CHECKOUT_REDIRECT_PATH,
        },
      };
    }

    const draft = await this.requireActionAdapter().createDraft({
      roomId: state.roomId,
      customerId: ownerId(state),
      action: 'CHECKOUT_REDIRECT',
      displayText: 'Đi tới thanh toán',
      redirectPath: CHECKOUT_REDIRECT_PATH,
      voucherCode,
      checkout,
      confirmedByBackend: false,
    });

    return {
      type: 'assistant_action_draft',
      draft,
      text: voucherCode
        ? `Mình đã điền thông tin giao hàng và chọn voucher ${voucherCode}; bạn xác nhận để chuyển sang bước thanh toán nhé.`
        : 'Mình đã điền thông tin giao hàng; bạn xác nhận để chuyển sang bước thanh toán nhé.',
      metadata: {
        checkoutReview,
        voucherCode,
        redirectPath: CHECKOUT_REDIRECT_PATH,
      },
    };
  }

  async validateVoucherAdvisory(state: ShoppingAssistantStateType) {
    const code = asString(state.parsedEntities?.voucherCode);
    if (!code) {
      const vouchers = await this.requireVoucherAdapter().listPublic({
        customerId: ownerId(state),
        subtotal: asNumber(state.parsedEntities?.subtotal) ?? 0,
      });
      const activeVouchers = Array.isArray(vouchers) ? vouchers.slice(0, 3) : [];
      const voucherText = activeVouchers.length
        ? `Hiện có thể thử các voucher: ${activeVouchers
            .map(formatVoucherSummary)
            .join('; ')}. Hệ thống sẽ xác thực chính thức ở bước thanh toán.`
        : 'Hiện mình chưa thấy voucher công khai còn hiệu lực. Nếu bạn có mã cụ thể, gửi mã để mình kiểm tra sơ bộ; bước thanh toán vẫn là nơi xác thực cuối cùng.';

      return {
        advisory: true,
        text: voucherText,
        voucher: null,
        vouchers: activeVouchers,
      };
    }

    const voucher = await this.requireVoucherAdapter().validatePublic({
      code,
      customerId: ownerId(state),
      subtotal: asNumber(state.parsedEntities?.subtotal) ?? 0,
    });

    return {
      advisory: true,
      text: 'Kết quả kiểm tra voucher trong chat chỉ mang tính tham khảo; bước thanh toán vẫn là nơi xác thực cuối cùng.',
      voucher,
    };
  }

  async lookupOwnedOrders(state: ShoppingAssistantStateType) {
    const authenticatedUserId = state.authenticatedUserId ?? state.customerId;
    if (!authenticatedUserId) {
      return {
        text: 'Đăng nhập để xem đơn hàng của bạn.',
        metadata: {
          loginRequired: true,
          primaryAction: {
            label: 'Đăng nhập để xem đơn hàng',
            action: 'LOGIN',
          },
        },
      };
    }

    return this.requireOrderLookupAdapter().findOwnedOrders(authenticatedUserId);
  }

  private async resolveProductByName(
    productName?: string,
  ): Promise<AssistantProductSnapshot | null> {
    const searchProducts =
      this.catalogAdapter?.searchProductsFast ??
      this.catalogAdapter?.searchProducts;
    if (
      !productName ||
      typeof searchProducts !== 'function' ||
      typeof this.catalogAdapter?.getSnapshotsByIds !== 'function'
    ) {
      return null;
    }

    const retrieval = await searchProducts.call(this.catalogAdapter, productName, {
      topK: 1,
    });
    const first = retrieval.results?.[0];
    const productId =
      asString(first?.productId) ?? asString(first?.payload?.productId);
    if (!productId) return null;

    const snapshot = (await this.catalogAdapter.getSnapshotsByIds([productId]))[0];
    return snapshot ? toAssistantProductSnapshot(snapshot) : null;
  }

  private async extractCheckoutFieldsWithProfile(
    state: ShoppingAssistantStateType,
  ): Promise<AssistantCheckoutFields> {
    const explicit = extractCheckoutFields(state);
    const saved = await this.customerProfileService?.getCheckoutFields(ownerId(state));

    return {
      name: explicit.name ?? saved?.name,
      phone: explicit.phone ?? saved?.phone,
      address: explicit.address ?? saved?.address,
    };
  }

  private async resolveCheckoutVoucherCode(
    state: ShoppingAssistantStateType,
  ): Promise<string | undefined> {
    const explicit = asString(state.parsedEntities?.voucherCode);
    if (explicit) return explicit.toUpperCase();
    if (!this.voucherAdapter || !wantsCheckoutVoucher(state)) return undefined;

    const vouchers = await this.voucherAdapter.listPublic({
      customerId: ownerId(state),
      subtotal: asNumber(state.parsedEntities?.subtotal) ?? 0,
    });
    const firstCode = Array.isArray(vouchers)
      ? asString(vouchers.find((voucher) => asString(voucher?.code))?.code)
      : undefined;
    return firstCode?.toUpperCase();
  }

  private async resolveProductSnapshot(
    product: AssistantRecommendationLedgerEntry | AssistantProductSnapshot,
  ) {
    if ('id' in product) return product;
    const snapshot = await this.requireActionAdapter().findProductSnapshot(
      product.productId,
    );
    return (
      snapshot ?? {
        id: product.productId,
        name: product.name,
        price: product.price,
        stock: product.stock,
      }
    );
  }

  private requireActionAdapter() {
    if (!this.actionAdapter) {
      throw new Error('AssistantActionAdapter is required for order tools');
    }
    return this.actionAdapter;
  }

  private requireVoucherAdapter() {
    if (!this.voucherAdapter) {
      throw new Error('VoucherAdapter is required for order tools');
    }
    return this.voucherAdapter;
  }

  private requireOrderLookupAdapter() {
    if (!this.orderLookupAdapter) {
      throw new Error('OrderLookupAdapter is required for order tools');
    }
    return this.orderLookupAdapter;
  }
}

function isCheckoutReviewAccepted(state: ShoppingAssistantStateType): boolean {
  return Boolean(
    state.parsedEntities?.checkoutReviewAccepted ||
      state.intentPlan?.checkoutReviewAccepted,
  );
}

function extractReference(state: ShoppingAssistantStateType): string | number | null {
  const entities = state.parsedEntities ?? {};
  const explicit =
    asString(entities.recommendationReference) ??
    asString(entities.reference) ??
    asString(entities.productReference);
  if (explicit) return explicit;
  const productEntity = asString(entities.productName) ?? asString(entities.product);
  if (productEntity && isOrdinalRecommendationReference(productEntity)) {
    return productEntity;
  }

  const text = state.userText ?? '';
  return extractRecommendationReference(text)?.phrase ?? null;
}

function extractProductName(state: ShoppingAssistantStateType): string | undefined {
  const userText = state.userText ?? '';
  if (isBareCartActionText(userText)) return undefined;

  const entities = state.parsedEntities ?? {};
  const explicit = asString(entities.productName) ?? asString(entities.product);
  if (explicit) {
    const normalizedExplicit = normalizeCommerceText(explicit);
    return !isCartOnlyPhrase(explicit) &&
      !isBareCartActionText(normalizedExplicit) &&
      !isOrdinalOnlyReference(explicit) &&
      !isOrdinalRecommendationReference(explicit)
      ? explicit
      : undefined;
  }

  const match = userText.match(
    /^\s*(?:lấy|lay|thêm|them|add)\s+(?:cho\s+(?:mình|minh|tôi|toi|em)\s+)?(?:giúp\s+(?:mình|minh)\s+)?(?:con|mẫu|mau|cái|cai|sản phẩm|san pham)?\s*(.+?)(?:\s+(?:vào|vao)\s+(?:giỏ|gio|cart).*)?$/iu,
  );
  const productName = match?.[1]
    ?.replace(/\s+(?:nhé|nhe|nha|bạn|ban)$/iu, '')
    .trim();
  return productName &&
    !/^c[aá]i\s+/iu.test(productName) &&
    !isCartOnlyPhrase(productName) &&
    !isOrdinalOnlyReference(productName) &&
    !isOrdinalRecommendationReference(productName)
    ? productName
    : undefined;
}

function wantsCheaperInStock(state: ShoppingAssistantStateType): boolean {
  const text = `${state.userText ?? ''} ${JSON.stringify(state.parsedEntities ?? {})}`.toLowerCase();
  return /rẻ hơn|re hon|c[oò]n h[aà]ng|con hang/.test(text);
}

function shouldUseFocusedLedgerProduct(
  state: ShoppingAssistantStateType,
  reference: string | number | null,
  productName?: string,
): boolean {
  if (reference || productName) return false;
  const action = asString(state.intentPlan?.cartAction) ?? asString(state.parsedEntities?.cartAction);
  return action === 'CART_ADD' || isBareCartActionText(state.userText ?? '');
}

function selectFocusedLedgerProduct(
  ledger: AssistantRecommendationLedgerEntry[],
): AssistantRecommendationLedgerEntry | null {
  return ledger.length === 1 ? ledger[0] : null;
}

function isBareCartActionText(text: string): boolean {
  const normalized = normalizeCommerceText(text);
  return /^(?:ok\s+)?(?:lay|them|add|chon|mua|dat)?\s*(?:vao\s+)?(?:gio|gio hang|cart)(?:\s+(?:cho|minh|toi|em|giup|nhe|nha|ban))*$/.test(
    normalized,
  );
}

function isCartOnlyPhrase(text: string): boolean {
  const normalized = normalizeCommerceText(text);
  return /^(?:vao\s+)?(?:gio|gio hang|cart)(?:\s+(?:cho|minh|toi|em|giup|nhe|nha|ban))*$/.test(
    normalized,
  );
}

function normalizeCommerceText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function selectCheapestInStock(
  ledger: AssistantRecommendationLedgerEntry[],
): AssistantRecommendationLedgerEntry | null {
  return (
    ledger
      .filter((item) => Number(item.stock ?? 0) > 0)
      .sort((left, right) => {
        const priceDelta = Number(left.price ?? Number.MAX_SAFE_INTEGER) - Number(right.price ?? Number.MAX_SAFE_INTEGER);
        return priceDelta || left.rank - right.rank;
      })[0] ?? null
  );
}

function extractCheckoutFields(
  state: ShoppingAssistantStateType,
): AssistantCheckoutFields {
  const entities = state.parsedEntities ?? {};
  const nested = isRecord(entities.checkout) ? entities.checkout : {};
  return {
    name: asString(nested.name) ?? asString(entities.name),
    phone: asString(nested.phone) ?? asString(entities.phone),
    address: asString(nested.address) ?? asString(entities.address),
  };
}

function wantsCheckoutVoucher(state: ShoppingAssistantStateType): boolean {
  const promptContext = state.promptContext as
    | { sections?: Array<{ kind?: unknown; content?: unknown }> }
    | undefined;
  const hotMessages = promptContext?.sections
    ?.filter((section) => section.kind === 'hotMessages')
    .map((section) => section.content)
    .filter((content): content is string => typeof content === 'string')
    .join(' ');
  const text = normalizeCommerceText(
    `${state.userText ?? ''} ${JSON.stringify(state.parsedEntities ?? {})} ${hotMessages ?? ''}`,
  );
  return /voucher|coupon|ma giam gia/.test(text);
}

function missingCheckoutFields(checkout: AssistantCheckoutFields): string[] {
  const missing: string[] = [];
  if (!checkout.name?.trim()) missing.push('name');
  if (!checkout.phone?.trim()) missing.push('phone');
  if (!checkout.address?.trim()) missing.push('address');
  return missing;
}

function ownerId(state: ShoppingAssistantStateType): string {
  return String(state.customerId ?? state.authenticatedUserId ?? '');
}

function cartActionDisplay(action: AssistantCartAction): string {
  if (action === 'CART_REMOVE') return 'Xóa khỏi giỏ';
  if (action === 'CART_SET_QUANTITY') return 'Cập nhật số lượng';
  return 'Thêm vào giỏ';
}

function formatVoucherSummary(voucher: any): string {
  const code = asString(voucher?.code) ?? 'voucher';
  const minimum = asNumber(voucher?.minimumOrderValue);
  const discountValue = asNumber(voucher?.discountValue);
  const maxDiscount = asNumber(voucher?.maximumDiscountAmount);
  const discountType = asString(voucher?.discountType);
  const discount = discountType === 'percentage'
    ? `${discountValue ?? 0}%${maxDiscount ? ` tối đa ${formatCurrency(maxDiscount)}` : ''}`
    : formatCurrency(discountValue ?? 0);
  return `${code} (${discount}${minimum ? `, đơn từ ${formatCurrency(minimum)}` : ''})`;
}

function formatCurrency(value: number): string {
  return `${value.toLocaleString('vi-VN')}₫`;
}

function productSummary(product: ResolvedOrderProduct): string {
  return 'rank' in product
    ? `rank:${product.rank};product:${product.productId}`
    : `product:${product.id}`;
}

function toAssistantProductSnapshot(
  snapshot: ProductCatalogSnapshot,
): AssistantProductSnapshot {
  return {
    id: snapshot.productId,
    slug: snapshot.slug,
    name: snapshot.name,
    price: snapshot.price,
    discountPrice: snapshot.discountPrice,
    image: snapshot.image,
    images: snapshot.images,
    stock: snapshot.stock,
    isPublished: snapshot.isPublished,
    isArchived: snapshot.isArchived,
    event: snapshot.event,
  };
}

function toolCall(
  toolName: string,
  status: AssistantToolCallTrace['status'],
  startedAt: number,
  inputSummary: string,
  outputSummary: string,
): AssistantToolCallTrace {
  return {
    toolName,
    subgraph: 'order',
    status,
    latencyMs: Date.now() - startedAt,
    inputSummary,
    outputSummary,
  };
}

function maskPhone(phone?: string): string | undefined {
  const digits = phone?.replace(/\D/g, '') ?? '';
  if (digits.length < 4) return undefined;
  return `${digits.slice(0, 3)}****${digits.slice(-3)}`;
}

function previewAddress(address?: string): string | undefined {
  const normalized = address?.trim();
  if (!normalized) return undefined;
  if (normalized.length <= 32) return normalized;
  return `${normalized.slice(0, 16)}...${normalized.slice(-10)}`;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
