import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { OrdersModule } from 'src/order/order.module';
import { ProductModule } from 'src/product/product.module';

import paymentConfig from './config/payment.config';

import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { Order, OrderSchema } from 'src/order/order.schema';

@Module({
  imports: [
    OrdersModule,
    ProductModule,
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
    ConfigModule.forFeature(paymentConfig),
  ],
  controllers: [PaymentController],
  providers: [PaymentService],
})
export class PaymentModule {}
