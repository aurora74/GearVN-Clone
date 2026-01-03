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

export type Order = {
  _id: string;
  userId: User;
  fullName: string;
  phone: string;
  address: string;
  note?: string;
  items: OrderItemWithProduct[];
  totalAmount: number;
  orderCode: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatusType;
  paymentMethod: PaymentMethod;
  createdAt: Date;
  updatedAt: Date;
};

export type OrderItemWithProduct = {
  productId: ProductType;
  quantity: number;
};

export type OrderItemWithId = {
  productId: string;
  quantity: number;
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
  paymentMethod: PaymentMethod;
  items: OrderItemWithId[];
  totalAmount: number;
};

export type UpdateOrderStatusPayload = {
  orderId: string;
  status: string;
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
