import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BlogCommentDocument = BlogComment & Document<Types.ObjectId>;
export type BlogCommentStatus = 'visible' | 'hidden' | 'deleted';

@Schema({ timestamps: true })
export class BlogComment {
  @Prop({ type: Types.ObjectId, ref: 'Blog', required: true, index: true })
  blogId: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  authorId: string;

  @Prop({ required: true })
  content: string;

  @Prop({ enum: ['visible', 'hidden', 'deleted'], default: 'visible', index: true })
  status: BlogCommentStatus;

  @Prop()
  moderationReason?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  moderatedBy?: string;

  @Prop({ type: Date })
  moderatedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const BlogCommentSchema = SchemaFactory.createForClass(BlogComment);
BlogCommentSchema.index({ blogId: 1, createdAt: -1 });
