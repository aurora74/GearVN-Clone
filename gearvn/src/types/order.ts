import { User } from "./user";
import { ProductType } from "./product";

export type OrderStatus =
  | "PROCESSING"
  | "SHIPPING"
  | "COMPLETED"
  | "CANCELLED"
  | string;

export type PaymentMethod = "COD" | "VNPAY" | string;

export type PaymentStatusType = "PENDING" | "PAID" | "CANCELLED" | string;

export type OrderItemSnapshot = {
  productId: ProductType;
  quantity: number;
  productName: string;
  productSlug: string;
  productImage: string;
  unitPrice: number;
  finalPrice: number;
  lineTotal: number;
  eventTag?: string;
  eventName?: string;
  originalPrice?: number;
  promotionStatus?: string;
};

export type OrderPromotionAdjustment = {
  type: "flash_sale" | "voucher" | string;
  code?: string;
  eventTag?: string;
  eventName?: string;
  voucherId?: string;
  voucherCode?: string;
  amount: number;
  description?: string;
};

export type OrderVoucherSnapshot = {
  voucherId: string;
  code: string;
  discountType?: string;
  discountValue?: number;
  minimumOrderValue?: number;
  maximumDiscountAmount?: number;
  discountAmount?: number;
  reservedUsage?: boolean;
  reservedAt?: string | Date;
  restoredAt?: string | Date;
};

export type OrderStatusHistory = {
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  changedBy?: string;
  changedByRole?: string;
  reason?: string;
  changedAt: string | Date;
};

export type OrderEvent = {
  type: string;
  message: string;
  actorId?: string;
  actorRole?: string;
  metadata?: Record<string, unknown>;
  createdAt: string | Date;
};

export type Order = {
  _id: string;
  userId: User | null;
  fullName: string;
  phone: string;
  address: string;
  note?: string;
  items: OrderItemSnapshot[];
  subtotalAmount?: number;
  productDiscountAmount?: number;
  voucherDiscountAmount?: number;
  promotionAdjustments?: OrderPromotionAdjustment[];
  voucherSnapshot?: OrderVoucherSnapshot;
  totalAmount: number;
  orderCode: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatusType;
  paymentMethod: PaymentMethod;
  paymentProvider?: string;
  paymentReference?: string;
  paymentResponseCode?: string;
  paymentAmount?: number;
  paymentSignatureValid?: boolean;
  paymentReconciledAt?: string | Date;
  statusHistory?: OrderStatusHistory[];
  orderEvents?: OrderEvent[];
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledByRole?: string;
  cancelledAt?: string | Date;
  createdAt: Date;
  updatedAt: Date;
};

export type OrderItemWithProduct = OrderItemSnapshot;

export type OrderItemWithId = {
  productId: string;
  quantity: number;
  clientFinalPrice?: number;
};

export type UseOrdersParams = {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  fields?: string;
  status?: string;
  orderStatus?: OrderStatus;
  paymentStatus?: PaymentStatusType;
  paymentMethod?: PaymentMethod;
  totalFrom?: number;
  totalTo?: number;
  dateFrom?: string;
  dateTo?: string;
};

export type CreateOrderPayload = {
  fullName: string;
  phone: string;
  address: string;
  note?: string;
  voucherCode?: string;
  paymentMethod: PaymentMethod;
  items: OrderItemWithId[];
};

export type CreateOrderDraft = Omit<CreateOrderPayload, "paymentMethod">;

export type UpdateOrderStatusPayload = {
  orderId: string;
  status: string;
  cancellationReason?: string;
};

export type CartItemType = {
  id: string;
  slug: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  finalPrice: number;
  discountPercent?: number;
  flashSaleEventName?: string;
  flashSaleEndsAt?: string;
  clientFinalPrice?: number;
  promotionWarning?: string;
  voucherWarning?: string;
  availabilityWarning?: string;
};

export type ProvinceType = {
  code: number | string;
  name: string;
};

export type DistrictType = {
  code: number | string;
  name: string;
  provinceCode?: number | string;
};

export type WardType = {
  code: number | string;
  name: string;
  districtCode?: number | string;
};

export type AddressFormData = {
  ward?: string;
  street?: string;
  district?: string;
  province?: string;
};

export type StepKeyType = "cart" | "order-info" | "payment" | "complete";

export type AddressFormValues = {
  phone: string;
  ward: string;
  street: string;
  province: string;
  district: string;
};
