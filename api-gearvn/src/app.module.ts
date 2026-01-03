import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ServeStaticModule } from '@nestjs/serve-static';

import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { BlogModule } from './blog/blog.module';
import { EventModule } from './event/event.module';
import { OrdersModule } from './order/order.module';
import { ProductModule } from './product/product.module';
import { PaymentModule } from './payment/payment.module';
import { CategoryModule } from './category/category.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ChatModule,
    AuthModule,
    UserModule,
    BlogModule,
    EventModule,
    OrdersModule,
    PaymentModule,
    ProductModule,
    CategoryModule,
    DashboardModule,
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
    }),
    MongooseModule.forRoot(process.env.MONGO_URI!),

    ServeStaticModule.forRoot({
      rootPath: join(__dirname, 'mail', 'assets'),
      serveRoot: '/assets',
    }),
  ],
})
export class AppModule {}
