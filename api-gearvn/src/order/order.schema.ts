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

  @Prop({ type: String })
  eventTag?: string;

  @Prop({ type: String })
  eventName?: string;

  @Prop({ type: Number, min: 0 })
  originalPrice?: number;

  @Prop({ type: String })
  promotionStatus?: string;
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

@Schema({ _id: false })
class PromotionAdjustment {
  @Prop({ type: String, enum: ['flash_sale', 'voucher'], required: true })
  type: 'flash_sale' | 'voucher';

  @Prop({ type: String })
  code?: string;

  @Prop({ type: String })
  eventTag?: string;

  @Prop({ type: String })
  eventName?: string;

  @Prop({ type: String })
  voucherId?: string;

  @Prop({ type: String })
  voucherCode?: string;

  @Prop({ type: Number, min: 0, required: true })
  amount: number;

  @Prop({ type: String })
  description?: string;
}

export const PromotionAdjustmentSchema =
  SchemaFactory.createForClass(PromotionAdjustment);

@Schema({ _id: false })
class VoucherSnapshot {
  @Prop({ type: String, required: true })
  voucherId: string;

  @Prop({ type: String, required: true })
  code: string;

  @Prop({ type: String, required: true })
  discountType: string;

  @Prop({ type: Number, min: 0, required: true })
  discountValue: number;

  @Prop({ type: Number, min: 0, required: true })
  minimumOrderValue: number;

  @Prop({ type: Number, min: 0 })
  maximumDiscountAmount?: number;

  @Prop({ type: Number, min: 0, required: true })
  discountAmount: number;

  @Prop({ type: Boolean, required: true })
  reservedUsage: boolean;

  @Prop({ type: Date, required: true })
  reservedAt: Date;

  @Prop({ type: Date })
  restoredAt?: Date;
}

export const VoucherSnapshotSchema = SchemaFactory.createForClass(VoucherSnapshot);

@Schema({ _id: false })
class OrderStatusHistory {
  @Prop({ type: String, enum: ['PROCESSING', 'SHIPPING', 'COMPLETED', 'CANCELLED'], required: true })
  fromStatus: 'PROCESSING' | 'SHIPPING' | 'COMPLETED' | 'CANCELLED';

  @Prop({ type: String, enum: ['PROCESSING', 'SHIPPING', 'COMPLETED', 'CANCELLED'], required: true })
  toStatus: 'PROCESSING' | 'SHIPPING' | 'COMPLETED' | 'CANCELLED';

  @Prop({ type: String })
  changedBy?: string;

  @Prop({ type: String })
  changedByRole?: string;

  @Prop({ type: String })
  reason?: string;

  @Prop({ type: Date, required: true })
  changedAt: Date;
}

export const OrderStatusHistorySchema = SchemaFactory.createForClass(OrderStatusHistory);

@Schema({ _id: false })
class OrderEvent {
  @Prop({ type: String, required: true })
  type: string;

  @Prop({ type: String, required: true })
  message: string;

  @Prop({ type: String })
  actorId?: string;

  @Prop({ type: String })
  actorRole?: string;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;

  @Prop({ type: Date, required: true })
  createdAt: Date;
}

export const OrderEventSchema = SchemaFactory.createForClass(OrderEvent);

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
  subtotalAmount: number;

  @Prop({ required: true, min: 0, default: 0 })
  productDiscountAmount: number;

  @Prop({ required: true, min: 0, default: 0 })
  voucherDiscountAmount: number;

  @Prop({ type: [PromotionAdjustmentSchema], default: [] })
  promotionAdjustments: PromotionAdjustment[];

  @Prop({ type: VoucherSnapshotSchema })
  voucherSnapshot?: VoucherSnapshot;

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

  @Prop({ type: [OrderStatusHistorySchema], default: [] })
  statusHistory: OrderStatusHistory[];

  @Prop({ type: [OrderEventSchema], default: [] })
  orderEvents: OrderEvent[];

  @Prop({ type: String })
  cancellationReason?: string;

  @Prop({ type: String })
  cancelledBy?: string;

  @Prop({ type: String })
  cancelledByRole?: string;

  @Prop({ type: Date })
  cancelledAt?: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
