import { Document } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: true })
export class Field {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  label: string;

  @Prop({ required: true, enum: ['text', 'number'] })
  type: 'text' | 'number';

  @Prop({ type: [String], required: false })
  options?: string[] | number[];
}

@Schema({ timestamps: true })
export class Category extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  label: string;

  @Prop({ type: [Object], default: [] })
  fields: Field[];

  @Prop({ required: false })
  image?: string;

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
}

export const CategorySchema = SchemaFactory.createForClass(Category);
