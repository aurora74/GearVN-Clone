import { Document } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type OrderItemDocument = OrderItem & Document;

@Schema({ _id: false })
class OrderItem {
  @Prop({ type: String, ref: 'Product', required: true })
  productId: string;

  @Prop({ required: true, min: 1 })
  quantity: number;
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

export type OrderDocument = Order & Document;

@Schema({ timestamps: true })
export class Order {
  @Prop({ type: String, unique: true, required: true })
  orderCode: string;

  @Prop({ type: String, ref: 'User', required: true })
  userId: string;

  @Prop({ type: String, required: true })
  fullName: string;

  @Prop({ type: String, required: true })
  phone: string;

  @Prop({ type: String, required: true })
  address: string;

  @Prop()
  note?: string;

  @Prop({ type: [OrderItemSchema], required: true })
  items: OrderItem[];

  @Prop({ required: true, min: 0 })
  totalAmount: number;

  @Prop({
    type: String,
    enum: ['COD', 'VNPAY'],
    required: false,
    default: null,
  })
  paymentMethod?: 'COD' | 'VNPAY' | null;

  @Prop({
    type: String,
    enum: ['PENDING', 'PAID', 'CANCELLED'],
    default: 'PENDING',
  })
  paymentStatus: 'PENDING' | 'PAID' | 'CANCELLED';

  @Prop({
    type: String,
    enum: ['PROCESSING', 'SHIPPING', 'COMPLETED', 'CANCELLED'],
    default: 'PROCESSING',
  })
  orderStatus: 'PROCESSING' | 'SHIPPING' | 'COMPLETED' | 'CANCELLED';
}

export const OrderSchema = SchemaFactory.createForClass(Order);
