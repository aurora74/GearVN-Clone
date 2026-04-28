import { Module } from '@nestjs/common';

import { UserModule } from 'src/user/user.module';
import { OrdersModule } from 'src/order/order.module';
import { ProductModule } from 'src/product/product.module';
import { PromotionModule } from 'src/promotion/promotion.module';

import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [UserModule, OrdersModule, ProductModule, PromotionModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
