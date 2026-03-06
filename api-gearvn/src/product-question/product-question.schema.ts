import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProductQuestionDocument = ProductQuestion & Document<Types.ObjectId>;
export type ProductQuestionPublicStatus = 'visible' | 'hidden' | 'deleted';
export type ProductQuestionRoleLabel = 'Customer' | 'Moderator';

@Schema({ timestamps: true })
export class ProductQuestionComment {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  authorId: string;

  @Prop({ required: true })
  authorRoleLabel: ProductQuestionRoleLabel;

  @Prop({ type: Boolean, default: false })
  isModerator: boolean;

  @Prop({ required: true })
  content: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ enum: ['visible', 'hidden', 'deleted'], default: 'visible' })
  moderationStatus: 'visible' | 'hidden' | 'deleted';

  @Prop()
  moderationReason?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  moderatedBy?: string;

  @Prop({ type: Date })
  moderatedAt?: Date;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;
}

@Schema({ timestamps: true })
export class ProductQuestion {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  productId: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  authorId: string;

  @Prop({ required: true })
  content: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ type: [ProductQuestionComment], default: [] })
  comments: ProductQuestionComment[];

  @Prop({ enum: ['visible', 'hidden', 'deleted'], default: 'visible', index: true })
  publicStatus: 'visible' | 'hidden' | 'deleted';

  @Prop({ enum: ['visible', 'hidden', 'deleted'], default: 'visible', index: true })
  moderationStatus: 'visible' | 'hidden' | 'deleted';

  @Prop()
  moderationReason?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  moderatedBy?: string;

  @Prop({ type: Date })
  moderatedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'SupportTicket' })
  ticketId?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ProductQuestionSchema = SchemaFactory.createForClass(ProductQuestion);
ProductQuestionSchema.index({ productId: 1, createdAt: -1 });
