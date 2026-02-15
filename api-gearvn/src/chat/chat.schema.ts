import { Document, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: true })
export class Chat {
  @Prop({ required: true, enum: ['CUSTOMER', 'ADMIN'] })
  sender: 'CUSTOMER' | 'ADMIN';

  @Prop({ required: true })
  text: string;

  @Prop({ required: true })
  roomId: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: string;

  @Prop({ type: [String], default: [] })
  attachments: string[];

  @Prop({ type: Boolean, default: false })
  isRead: boolean;

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;

  @Prop({ type: Number, default: 0 })
  unreadCount: number;
}

export const ChatSchema = SchemaFactory.createForClass(Chat);
export type ChatDocument = Chat & Document<Types.ObjectId>;
