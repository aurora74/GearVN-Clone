import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { EventService } from '../event/event.service';
import { VoucherService } from '../voucher/voucher.service';
import { Order, OrderDocument } from '../order/order.schema';
import { OrderStatus } from '../order/enums/order-status';

type FlashSaleSummary = {
  activeFlashSales: number;
  scheduledFlashSales: number;
  endedFlashSales: number;
};

type PromotionCampaignType = 'flash_sale' | 'voucher';

type PromotionCampaignRow = {
  id: string;
  name: string;
  type: PromotionCampaignType;
  orders?: number;
  productsSold?: number;
  uses?: number;
  discountAmount: number;
};

type FlashSaleCampaignAggregate = {
  _id: string;
  name: string;
  orders: string[];
  productsSold: number;
};

type FlashSaleDiscountAggregate = {
  _id: string;
  discountAmount: number;
};

type VoucherCampaignAggregate = {
  _id: string;
  name: string;
  uses: number;
  discountAmount: number;
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

  async getAnalyticsSummary(startDate: Date, endDate: Date, limit = 5) {
    const [flashSaleSummary, voucherSummary, orderSummary, topCampaigns] =
      await Promise.all([
        this.getFlashSaleSummary(),
        this.voucherService.getVoucherUsageSummary(),
        this.getDateFilteredOrderPromotionSummary(startDate, endDate),
        this.getTopCampaigns(startDate, endDate, limit),
      ]);

    return {
      summary: {
        activeFlashSales: flashSaleSummary.activeFlashSales,
        scheduledFlashSales: flashSaleSummary.scheduledFlashSales,
        endedFlashSales: flashSaleSummary.endedFlashSales,
        activeVouchers: voucherSummary.activeVouchers,
        totalVoucherUses: orderSummary.totalVoucherUses,
        totalVoucherDiscountAmount: orderSummary.totalVoucherDiscountAmount,
        flashSaleOrdersCount: orderSummary.flashSaleOrdersCount,
        flashSaleProductsSold: orderSummary.flashSaleProductsSold,
      },
      topCampaigns,
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

  private getCompletedOrderRangeMatch(startDate?: Date, endDate?: Date) {
    return {
      orderStatus: OrderStatus.COMPLETED,
      ...(startDate && endDate
        ? {
            createdAt: {
              $gte: startDate,
              $lte: endDate,
            },
          }
        : {}),
    };
  }

  private async getDateFilteredOrderPromotionSummary(
    startDate: Date,
    endDate: Date,
  ) {
    const [summary] = await this.orderModel.aggregate<{
      totalVoucherUses: number;
      totalVoucherDiscountAmount: number;
      flashSaleOrdersCount: number;
      flashSaleProductsSold: number;
    }>([
      { $match: this.getCompletedOrderRangeMatch(startDate, endDate) },
      {
        $facet: {
          vouchers: [
            { $unwind: '$promotionAdjustments' },
            { $match: { 'promotionAdjustments.type': 'voucher' } },
            {
              $group: {
                _id: null,
                totalVoucherUses: { $sum: 1 },
                totalVoucherDiscountAmount: {
                  $sum: { $ifNull: ['$promotionAdjustments.amount', 0] },
                },
              },
            },
          ],
          flashSaleOrders: [
            { $unwind: '$promotionAdjustments' },
            { $match: { 'promotionAdjustments.type': 'flash_sale' } },
            { $group: { _id: '$_id' } },
            { $count: 'flashSaleOrdersCount' },
          ],
          flashSaleProducts: [
            { $unwind: '$items' },
            { $match: { 'items.eventTag': { $exists: true, $ne: null } } },
            {
              $group: {
                _id: null,
                flashSaleProductsSold: { $sum: '$items.quantity' },
              },
            },
          ],
        },
      },
      {
        $project: {
          totalVoucherUses: {
            $ifNull: [{ $arrayElemAt: ['$vouchers.totalVoucherUses', 0] }, 0],
          },
          totalVoucherDiscountAmount: {
            $ifNull: [
              { $arrayElemAt: ['$vouchers.totalVoucherDiscountAmount', 0] },
              0,
            ],
          },
          flashSaleOrdersCount: {
            $ifNull: [
              { $arrayElemAt: ['$flashSaleOrders.flashSaleOrdersCount', 0] },
              0,
            ],
          },
          flashSaleProductsSold: {
            $ifNull: [
              { $arrayElemAt: ['$flashSaleProducts.flashSaleProductsSold', 0] },
              0,
            ],
          },
        },
      },
    ]);

    return {
      totalVoucherUses: summary?.totalVoucherUses ?? 0,
      totalVoucherDiscountAmount: summary?.totalVoucherDiscountAmount ?? 0,
      flashSaleOrdersCount: summary?.flashSaleOrdersCount ?? 0,
      flashSaleProductsSold: summary?.flashSaleProductsSold ?? 0,
    };
  }

  private async getTopCampaigns(
    startDate: Date,
    endDate: Date,
    limit: number,
  ): Promise<PromotionCampaignRow[]> {
    const [flashSaleItems, flashSaleDiscounts, vouchers] = await Promise.all([
      this.orderModel.aggregate<FlashSaleCampaignAggregate>([
        { $match: this.getCompletedOrderRangeMatch(startDate, endDate) },
        { $unwind: '$items' },
        { $match: { 'items.eventTag': { $exists: true, $ne: null } } },
        {
          $group: {
            _id: '$items.eventTag',
            name: { $first: '$items.eventName' },
            orders: { $addToSet: '$_id' },
            productsSold: { $sum: '$items.quantity' },
          },
        },
      ]),
      this.orderModel.aggregate<FlashSaleDiscountAggregate>([
        { $match: this.getCompletedOrderRangeMatch(startDate, endDate) },
        { $unwind: '$promotionAdjustments' },
        { $match: { 'promotionAdjustments.type': 'flash_sale' } },
        {
          $group: {
            _id: '$promotionAdjustments.eventTag',
            discountAmount: {
              $sum: { $ifNull: ['$promotionAdjustments.amount', 0] },
            },
          },
        },
      ]),
      this.orderModel.aggregate<VoucherCampaignAggregate>([
        { $match: this.getCompletedOrderRangeMatch(startDate, endDate) },
        { $unwind: '$promotionAdjustments' },
        { $match: { 'promotionAdjustments.type': 'voucher' } },
        {
          $group: {
            _id: {
              $ifNull: [
                '$promotionAdjustments.voucherId',
                '$promotionAdjustments.voucherCode',
              ],
            },
            name: { $first: '$promotionAdjustments.voucherCode' },
            uses: { $sum: 1 },
            discountAmount: {
              $sum: { $ifNull: ['$promotionAdjustments.amount', 0] },
            },
          },
        },
      ]),
    ]);

    const discountByFlashSale = new Map(
      flashSaleDiscounts.map((campaign) => [
        campaign._id,
        campaign.discountAmount ?? 0,
      ]),
    );

    const flashSaleRows: PromotionCampaignRow[] = flashSaleItems.map(
      (campaign) => ({
        id: campaign._id,
        name: campaign.name || campaign._id,
        type: 'flash_sale',
        orders: campaign.orders.length,
        productsSold: campaign.productsSold ?? 0,
        discountAmount: discountByFlashSale.get(campaign._id) ?? 0,
      }),
    );

    const voucherRows: PromotionCampaignRow[] = vouchers.map((campaign) => ({
      id: campaign._id,
      name: campaign.name || campaign._id,
      type: 'voucher',
      uses: campaign.uses ?? 0,
      discountAmount: campaign.discountAmount ?? 0,
    }));

    return [...flashSaleRows, ...voucherRows]
      .sort((left, right) => right.discountAmount - left.discountAmount)
      .slice(0, limit);
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
