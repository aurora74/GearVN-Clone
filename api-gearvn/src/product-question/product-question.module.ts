import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { Product, ProductSchema } from '../product/product.schema';
import { SupportTicketModule } from '../support-ticket/support-ticket.module';
import { ModerationModule } from '../moderation/moderation.module';
import {
  ProductQuestion,
  ProductQuestionSchema,
} from './product-question.schema';
import { ProductQuestionController } from './product-question.controller';
import { ProductQuestionService } from './product-question.service';

@Module({
  imports: [
    CloudinaryModule,
    SupportTicketModule,
    ModerationModule,
    MongooseModule.forFeature([
      { name: ProductQuestion.name, schema: ProductQuestionSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
  ],
  controllers: [ProductQuestionController],
  providers: [ProductQuestionService],
  exports: [ProductQuestionService],
})
export class ProductQuestionModule {}
