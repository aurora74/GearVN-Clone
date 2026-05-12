import { Injectable, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { ORDER_STATUS } from '../../../config.global';
import { Order, OrderDocument } from '../../../order/order.schema';
import type { OrderService } from '../../../order/order.service';

export type AssistantAllowedOrderStatus =
  (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export interface OrderLookupParams {
  orderStatus?: string;
}

const ALLOWED_STATUSES = new Set<string>([
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.SHIPPING,
  ORDER_STATUS.COMPLETED,
  ORDER_STATUS.CANCELLED,
]);

@Injectable()
export class OrderLookupAdapter {
  constructor(
    @Optional() private readonly orderService?: OrderService,
    @Optional()
    @InjectModel(Order.name)
    private readonly orderModel?: Model<OrderDocument>,
  ) {}

  async findOwnedOrders(authenticatedUserId: string, params: OrderLookupParams = {}) {
    if (!this.orderService) {
      return this.findOwnedOrdersByModel(authenticatedUserId, params);
    }

    const orderStatus = mapOrderStatus(params.orderStatus);
    return this.orderService.findMyOrders(authenticatedUserId, {
      page: 1,
      limit: 5,
      orderStatus,
      sortBy: '-createdAt',
    });
  }
  private async findOwnedOrdersByModel(
    authenticatedUserId: string,
    params: OrderLookupParams = {},
  ) {
    if (!this.orderModel) {
      return { page: 1, limit: 5, total: 0, totalPages: 0, data: [] };
    }
    const orderStatus = mapOrderStatus(params.orderStatus);
    const query: Record<string, unknown> = { userId: authenticatedUserId };
    if (orderStatus) query.orderStatus = orderStatus;

    const [total, data] = await Promise.all([
      this.orderModel.countDocuments(query),
      this.orderModel
        .find(query)
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
        .exec(),
    ]);

    return {
      page: 1,
      limit: 5,
      total,
      totalPages: Math.ceil(total / 5),
      data,
    };
  }
}

export function mapOrderStatus(status?: string): AssistantAllowedOrderStatus | undefined {
  if (!status) return undefined;
  return ALLOWED_STATUSES.has(status)
    ? (status as AssistantAllowedOrderStatus)
    : undefined;
}

export function isAllowedOrderStatus(status?: string): boolean {
  return !status || ALLOWED_STATUSES.has(status);
}
