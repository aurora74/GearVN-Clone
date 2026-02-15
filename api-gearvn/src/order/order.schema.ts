import { Document } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type OrderItemDocument = OrderItem & Document;

@Schema({ _id: false })
class OrderItem {
  @Prop({ type: String, ref: 'Product', required: true })
  productId: string;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ type: String, required: true })
  productName: string;

  @Prop({ type: String, required: true })
  productSlug: string;

  @Prop({ type: String, required: true })
  productImage: string;

  @Prop({ required: true, min: 0 })
  unitPrice: number;

  @Prop({ required: true, min: 0 })
  finalPrice: number;

  @Prop({ required: true, min: 0 })
  lineTotal: number;
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

  @Prop({ type: String })
  paymentProvider?: string;

  @Prop({ type: String })
  paymentReference?: string;

  @Prop({ type: String })
  paymentResponseCode?: string;

  @Prop({ type: Number, min: 0 })
  paymentAmount?: number;

  @Prop({ type: Boolean })
  paymentSignatureValid?: boolean;

  @Prop({ type: Date })
  paymentReconciledAt?: Date;

  @Prop({
    type: String,
    enum: ['NONE', 'RESERVED', 'COMMITTED', 'RELEASED'],
    default: 'NONE',
  })
  inventoryStatus: 'NONE' | 'RESERVED' | 'COMMITTED' | 'RELEASED';

  @Prop({ type: Date })
  inventoryReservedAt?: Date;

  @Prop({ type: Date })
  inventoryCommittedAt?: Date;

  @Prop({ type: Date })
  inventoryReleasedAt?: Date;

  @Prop({
    type: String,
    enum: ['PROCESSING', 'SHIPPING', 'COMPLETED', 'CANCELLED'],
    default: 'PROCESSING',
  })
  orderStatus: 'PROCESSING' | 'SHIPPING' | 'COMPLETED' | 'CANCELLED';
}

export const OrderSchema = SchemaFactory.createForClass(Order);
