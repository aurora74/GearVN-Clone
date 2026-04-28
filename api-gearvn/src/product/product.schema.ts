import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Document, Types } from 'mongoose';

export type ProductDocument = Product & Document;

@Schema({ timestamps: true })
export class Reply {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop({ type: String, ref: 'User', required: true })
  userId: string;

  @Prop({ required: true })
  content: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ type: [String], default: [] })
  likes: string[];

  @Prop({ enum: ['visible', 'hidden', 'deleted'], default: 'visible' })
  moderationStatus: 'visible' | 'hidden' | 'deleted';

  @Prop()
  moderationReason?: string;

  @Prop({ type: String, ref: 'User' })
  moderatedBy?: string;

  @Prop({ type: Date })
  moderatedAt?: Date;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;
}

@Schema()
export class Comment {
  @Prop({ type: String, ref: 'User', required: true })
  userId: string;

  @Prop({ required: true })
  content: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ type: [String], default: [] })
  likes: string[];

  @Prop({ type: [Reply], default: [] })
  replies: Reply[];

  @Prop({ enum: ['visible', 'hidden', 'deleted'], default: 'visible' })
  moderationStatus: 'visible' | 'hidden' | 'deleted';

  @Prop()
  moderationReason?: string;

  @Prop({ type: String, ref: 'User' })
  moderatedBy?: string;

  @Prop({ type: Date })
  moderatedAt?: Date;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;
}

@Schema({ timestamps: true })
export class Product {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  slug: string;

  @Prop({ required: true })
  category: string;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ required: true, min: 0 })
  discountPrice: number;

  @Prop({ required: true, min: 0, max: 100 })
  discountPercent: number;

  @Prop()
  description?: string;

  @Prop({
    type: [String],
    required: true,
    validate: [
      (val: string[]) => val.length > 0,
      'At least one image is required',
    ],
  })
  images: string[];

  @Prop({ type: Map, of: MongooseSchema.Types.Mixed })
  attributes: Record<string, any>;

  @Prop({ type: [Comment], default: [] })
  comments: Comment[];

  @Prop({ type: Number, default: 0 })
  averageRating: number;

  @Prop({ type: Number, default: 0 })
  ratingsCount: number;

  @Prop({ required: true, min: 0, default: 0 })
  stock: number;

  @Prop({ type: Boolean, default: true, index: true })
  isPublished: boolean;

  @Prop({ type: Date })
  publishedAt?: Date;

  @Prop({ type: Date })
  unpublishedAt?: Date;

  @Prop({ type: Boolean, default: false, index: true })
  isArchived: boolean;

  @Prop({ type: Date })
  archivedAt?: Date;

  @Prop({ type: Number, default: 0, min: 0 })
  soldQuantity: number;

  @Prop()
  event?: string;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.index({ isArchived: 1, isPublished: 1, stock: 1 });
ProductSchema.index({ isArchived: 1, soldQuantity: -1 });
