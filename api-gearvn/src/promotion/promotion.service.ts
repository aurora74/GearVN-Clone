import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { EventService } from '../event/event.service';
import { VoucherService } from '../voucher/voucher.service';
import { Order, OrderDocument } from '../order/order.schema';

type FlashSaleSummary = {
  activeFlashSales: number;
  scheduledFlashSales: number;
  endedFlashSales: number;
};

@Injectable()
export class PromotionService {
  constructor(
    private readonly eventService: EventService,
    private readonly voucherService: VoucherService,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
  ) {}

  async getSummary() {
    const [flashSaleSummary, voucherSummary, orderSummary] = await Promise.all([
      this.getFlashSaleSummary(),
      this.voucherService.getVoucherUsageSummary(),
      this.getOrderPromotionSummary(),
    ]);

    return {
      activeFlashSales: flashSaleSummary.activeFlashSales,
      scheduledFlashSales: flashSaleSummary.scheduledFlashSales,
      endedFlashSales: flashSaleSummary.endedFlashSales,
      activeVouchers: voucherSummary.activeVouchers,
      totalVoucherUses: voucherSummary.totalUsage,
      totalDiscountedAmount: orderSummary.totalDiscountedAmount,
      flashSaleProductsCount: orderSummary.flashSaleProductsCount,
      flashSaleOrdersCount: orderSummary.flashSaleOrdersCount,
    };
  }

  private async getFlashSaleSummary(): Promise<FlashSaleSummary> {
    const events = await this.eventService.findAll({
      page: 1,
      limit: 1000,
    });
    const data = (events.data ?? []) as Array<{ status?: string }>;

    return data.reduce<FlashSaleSummary>(
      (summary, event) => {
        if (event.status === 'active') summary.activeFlashSales += 1;
        if (event.status === 'scheduled') summary.scheduledFlashSales += 1;
        if (event.status === 'ended' || event.status === 'expired') {
          summary.endedFlashSales += 1;
        }
        return summary;
      },
      {
        activeFlashSales: 0,
        scheduledFlashSales: 0,
        endedFlashSales: 0,
      },
    );
  }

  private async getOrderPromotionSummary() {
    const [summary] = await this.orderModel.aggregate<{
      totalDiscountedAmount: number;
      flashSaleProductsCount: number;
      flashSaleOrdersCount: number;
    }>([
      {
        $facet: {
          totals: [
            { $unwind: '$promotionAdjustments' },
            {
              $group: {
                _id: null,
                totalDiscountedAmount: {
                  $sum: { $ifNull: ['$promotionAdjustments.amount', 0] },
                },
                flashSaleOrders: {
                  $addToSet: {
                    $cond: [
                      { $eq: ['$promotionAdjustments.type', 'flash_sale'] },
                      '$_id',
                      '$$REMOVE',
                    ],
                  },
                },
              },
            },
            {
              $project: {
                _id: 0,
                totalDiscountedAmount: 1,
                flashSaleOrdersCount: { $size: '$flashSaleOrders' },
              },
            },
          ],
          products: [
            { $unwind: '$items' },
            { $match: { 'items.eventTag': { $exists: true, $ne: null } } },
            { $group: { _id: '$items.productId' } },
            { $count: 'flashSaleProductsCount' },
          ],
        },
      },
      {
        $project: {
          totalDiscountedAmount: {
            $ifNull: [{ $arrayElemAt: ['$totals.totalDiscountedAmount', 0] }, 0],
          },
          flashSaleOrdersCount: {
            $ifNull: [{ $arrayElemAt: ['$totals.flashSaleOrdersCount', 0] }, 0],
          },
          flashSaleProductsCount: {
            $ifNull: [
              { $arrayElemAt: ['$products.flashSaleProductsCount', 0] },
              0,
            ],
          },
        },
      },
    ]);

    return {
      totalDiscountedAmount: summary?.totalDiscountedAmount ?? 0,
      flashSaleProductsCount: summary?.flashSaleProductsCount ?? 0,
      flashSaleOrdersCount: summary?.flashSaleOrdersCount ?? 0,
    };
  }
}
