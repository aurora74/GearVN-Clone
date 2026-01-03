import { Document } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type BlogDocument = Blog & Document;

@Schema({ timestamps: true })
export class Blog {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop({ required: true })
  summary: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  thumbnail: string;
}

export const BlogSchema = SchemaFactory.createForClass(Blog);
