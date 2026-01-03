import { Injectable } from '@nestjs/common';

import { UserService } from 'src/user/user.service';
import { OrderService } from 'src/order/order.service';
import { ProductService } from 'src/product/product.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly userService: UserService,
    private readonly orderService: OrderService,
    private readonly productService: ProductService,
  ) {}

  async getSummary() {
    const now = new Date();
    const currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentEnd = now;

    const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousEnd = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      now.getDate(),
    );

    const totalRevenue = await this.orderService.getTotalRevenue(
      currentStart,
      currentEnd,
    );
    const revenueGrowth = await this.orderService.getRevenueGrowth(
      currentStart,
      currentEnd,
      previousStart,
      previousEnd,
    );

    const ordersCount = await this.orderService.getOrdersCount(
      currentStart,
      currentEnd,
    );
    const ordersGrowth = await this.orderService.getOrdersGrowth(
      currentStart,
      currentEnd,
      previousStart,
      previousEnd,
    );

    const newCustomers = await this.userService.getNewCustomersCount(
      currentStart,
      currentEnd,
    );
    const newCustomersDecline = await this.userService.getNewCustomersDecline(
      currentStart,
      currentEnd,
      previousStart,
      previousEnd,
    );

    const topProduct = await this.productService.getTopSellingProduct();

    const salesOrdersTrend = await this.orderService.getSalesAndOrdersByDate(
      currentStart,
      currentEnd,
    );

    return {
      totalRevenue,
      revenueGrowth,
      ordersCount,
      ordersGrowth,
      newCustomers,
      newCustomersDecline,
      topProduct,
      salesOrdersTrend,
    };
  }
}
