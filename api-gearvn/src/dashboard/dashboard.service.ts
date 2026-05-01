import { BadRequestException, Injectable } from '@nestjs/common';

import { UserService } from 'src/user/user.service';
import { OrderService } from 'src/order/order.service';
import { ProductService } from 'src/product/product.service';
import { DashboardSummaryQueryDto } from './dto/dashboard-summary-query.dto';
import { PromotionService } from 'src/promotion/promotion.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly userService: UserService,
    private readonly orderService: OrderService,
    private readonly productService: ProductService,
    private readonly promotionService: PromotionService,
  ) {}

  async getSummary(query: DashboardSummaryQueryDto = {}) {
    const { currentStart, currentEnd, previousStart, previousEnd, preset } =
      this.resolveDateRange(query);

    const [
      totalRevenue,
      revenueGrowth,
      ordersCount,
      ordersGrowth,
      newCustomers,
      newCustomersDecline,
      totalCustomers,
      topProduct,
      salesOrdersTrend,
      paymentBreakdown,
      pipeline,
      productAnalytics,
      periodTopSellers,
      promotionAnalytics,
    ] = await Promise.all([
      this.orderService.getTotalRevenue(currentStart, currentEnd),
      this.orderService.getRevenueGrowth(
        currentStart,
        currentEnd,
        previousStart,
        previousEnd,
      ),
      this.orderService.getOrdersCount(currentStart, currentEnd),
      this.orderService.getOrdersGrowth(
        currentStart,
        currentEnd,
        previousStart,
        previousEnd,
      ),
      this.userService.getNewCustomersCount(currentStart, currentEnd),
      this.userService.getNewCustomersDecline(
        currentStart,
        currentEnd,
        previousStart,
        previousEnd,
      ),
      this.userService.getCustomersCount(),
      this.productService.getTopSellingProduct(),
      this.orderService.getSalesAndOrdersByDate(currentStart, currentEnd),
      this.orderService.getCompletedRevenueByPaymentMethod(
        currentStart,
        currentEnd,
      ),
      this.orderService.getOrderPipelineSummary(currentStart, currentEnd),
      this.productService.getProductAnalytics({ lowStockThreshold: 5, limit: 5 }),
      this.orderService.getTopSellingProducts(currentStart, currentEnd, 5),
      this.promotionService.getAnalyticsSummary(currentStart, currentEnd),
    ]);

    const dateRange = {
      preset,
      currentStart,
      currentEnd,
      previousStart,
      previousEnd,
    };
    const comparison = {
      previousStart,
      previousEnd,
      revenueGrowth,
      ordersGrowth,
      customerGrowth: newCustomersDecline,
    };
    const kpis = {
      totalRevenue,
      ordersCount,
      newCustomers,
      totalCustomers,
      totalProducts: productAnalytics.totalProducts,
      activeProducts: productAnalytics.activeProducts,
    };
    const productPerformance = {
      topSellers: periodTopSellers,
      topProduct,
    };
    const stockAlerts = {
      lowStockProducts: productAnalytics.lowStockProducts,
      outOfStockProducts: productAnalytics.outOfStockProducts,
      unpublishedLowStockCount: productAnalytics.unpublishedLowStockCount,
    };

    return {
      dateRange,
      comparison,
      kpis,
      paymentBreakdown,
      pipeline,
      salesOrdersTrend,
      productPerformance,
      stockAlerts,
      promotionAnalytics,
      totalRevenue,
      revenueGrowth,
      ordersCount,
      ordersGrowth,
      newCustomers,
      newCustomersDecline,
      topProduct,
    };
  }

  private resolveDateRange(
    query: DashboardSummaryQueryDto = {},
    now = new Date(),
  ) {
    const normalizedQuery = { preset: '30d' as const, ...query };
    const preset = normalizedQuery.preset;
    let currentStart: Date;
    let currentEnd: Date;

    if (preset === 'custom') {
      if (!normalizedQuery.startDate || !normalizedQuery.endDate) {
        throw new BadRequestException('Invalid dashboard date range');
      }

      currentStart = new Date(normalizedQuery.startDate);
      currentEnd = new Date(normalizedQuery.endDate);

      if (
        Number.isNaN(currentStart.getTime()) ||
        Number.isNaN(currentEnd.getTime()) ||
        currentStart.getTime() > currentEnd.getTime()
      ) {
        throw new BadRequestException('Invalid dashboard date range');
      }
    } else {
      const days = preset === '7d' ? 7 : preset === '90d' ? 90 : 30;
      currentEnd = now;
      currentStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }

    const duration = currentEnd.getTime() - currentStart.getTime();
    const previousEnd = new Date(currentStart.getTime() - 1);
    const previousStart = new Date(previousEnd.getTime() - duration);

    return {
      currentStart,
      currentEnd,
      previousStart,
      previousEnd,
      preset,
    };
  }
}
