import { Module } from '@nestjs/common';

import { UserModule } from 'src/user/user.module';
import { OrdersModule } from 'src/order/order.module';
import { ProductModule } from 'src/product/product.module';

import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [UserModule, OrdersModule, ProductModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
