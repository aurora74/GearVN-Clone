import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Category, CategorySchema } from '../category/category.schema';
import { Product, ProductSchema } from '../product/product.schema';
import { ProductCorpusImporter } from './product-corpus.importer';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Category.name, schema: CategorySchema },
    ]),
  ],
  providers: [ProductCorpusImporter],
  exports: [ProductCorpusImporter],
})
export class ProductCorpusModule {}
