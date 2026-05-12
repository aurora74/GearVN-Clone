export {
  OrderLookupAdapter,
  isAllowedOrderStatus,
  mapOrderStatus,
} from '../adapters/order.adapter';

import { ORDER_STATUS } from '../../../config.global';
import {
  isAllowedOrderStatus,
  mapOrderStatus,
  OrderLookupAdapter,
} from '../adapters/order.adapter';
import type { AssistantOrderCard } from '../assistant.types';

interface OrderLookupState {
  userText?: string;
  authenticatedUserId?: string | null;
  parsedEntities?: Record<string, unknown>;
  intentPlan?: {
    needsOrderLookup?: boolean;
    orderStatus?: string;
  };
}

interface OrderLookupDependencies {
  orderLookupAdapter: OrderLookupAdapter | OrderLookupTestAdapter;
}

interface OrderLookupTestAdapter {
  findMyOrders(
    authenticatedUserId: string,
    params: { orderStatus?: string },
  ): Promise<any>;
  findOwnedOrders?: (
    authenticatedUserId: string,
    params: { orderStatus?: string },
  ) => Promise<any>;
}

const STATUS_LABELS: Record<string, string> = {
  [ORDER_STATUS.PROCESSING]: 'Đơn đang xử lý',
  [ORDER_STATUS.SHIPPING]: 'Đơn đang giao',
  [ORDER_STATUS.COMPLETED]: 'Đơn đã hoàn tất',
  [ORDER_STATUS.CANCELLED]: 'Đơn đã hủy',
};

export async function orderLookupNode(
  state: OrderLookupState,
  deps: OrderLookupDependencies,
) {
  if (!state.authenticatedUserId) {
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

  const requestedStatus = state.intentPlan?.orderStatus;
  if (!isAllowedOrderStatus(requestedStatus)) {
    return {
      text: 'Bạn muốn xem trạng thái đơn hàng nào?',
      metadata: {
        needsClarification: true,
      },
    };
  }

  const orderStatus = mapOrderStatus(requestedStatus);
  const result = await callOwnedOrderLookup(
    deps.orderLookupAdapter,
    state.authenticatedUserId,
    orderStatus ? { orderStatus } : {},
  );
  const orderCards = (result?.data ?? []).map(toSafeOrderCard);
  const label = orderStatus ? STATUS_LABELS[orderStatus] : 'Đơn hàng của bạn';

  return {
    text: `${label}: ${orderCards.length} đơn hàng gần nhất.`,
    metadata: {
      orderStatus,
      orderCards,
      total: result?.total ?? orderCards.length,
    },
  };
}

async function callOwnedOrderLookup(
  adapter: OrderLookupAdapter | OrderLookupTestAdapter,
  authenticatedUserId: string,
  params: { orderStatus?: string },
) {
  if (typeof adapter.findOwnedOrders === 'function') {
    return adapter.findOwnedOrders(authenticatedUserId, params);
  }
  return (adapter as OrderLookupTestAdapter).findMyOrders(
    authenticatedUserId,
    params,
  );
}

function toSafeOrderCard(order: any): AssistantOrderCard {
  const source = order && typeof order === 'object' ? order : {};
  const orderId = normalizeOrderId(source.id ?? source._id ?? source.orderCode);
  const orderCode = normalizeString(source.orderCode);
  const createdAt = normalizeDate(source.createdAt);
  const status = normalizeString(source.orderStatus) ?? 'UNKNOWN';
  const paymentStatus = normalizeString(source.paymentStatus);
  const total = normalizeNumber(source.totalAmount);
  const items = (Array.isArray(source.items) ? source.items : [])
    .map(toSafeOrderItem)
    .filter((item) => item.productId || item.name || item.quantity != null);

  return {
    orderId,
    ...(orderCode ? { orderCode } : {}),
    ...(createdAt ? { createdAt } : {}),
    status,
    ...(paymentStatus ? { paymentStatus } : {}),
    ...(total != null ? { total } : {}),
    items,
    detailHref: `/orders/${orderId || orderCode || ''}`,
  };
}

function toSafeOrderItem(item: any) {
  const source = item && typeof item === 'object' ? item : {};
  const name = normalizeString(
    source.name ?? source.productName ?? source.productId?.name,
  );
  const quantity = normalizeNumber(source.quantity);

  return {
    productId: normalizeProductId(source.productId),
    ...(name ? { name } : {}),
    ...(quantity != null ? { quantity } : {}),
  };
}

function normalizeOrderId(orderId: any): string {
  return normalizeString(orderId?._id ?? orderId?.id ?? orderId) ?? '';
}

function normalizeProductId(productId: any): string | undefined {
  return normalizeString(productId?._id ?? productId?.id ?? productId);
}

function normalizeString(value: any): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  return undefined;
}

function normalizeDate(value: any): string | undefined {
  const raw = normalizeString(value);
  if (!raw) return undefined;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function normalizeNumber(value: any): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}
