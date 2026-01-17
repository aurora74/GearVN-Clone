import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AuditModule } from 'src/audit/audit.module';
import { EventModule } from 'src/event/event.module';
import { ProductModule } from 'src/product/product.module';
import { VoucherModule } from 'src/voucher/voucher.module';

import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { Order, OrderSchema } from './order.schema';

@Module({
  imports: [
    ProductModule,
    EventModule,
    VoucherModule,
    AuditModule,
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
  ],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrdersModule {}
