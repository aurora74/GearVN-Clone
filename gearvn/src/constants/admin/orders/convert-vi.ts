import { OrderStatus, PaymentMethod, PaymentStatusType } from "@/types/order";

export const PAYMENT_STATUS_VI: Record<PaymentStatusType, string> = {
  PENDING: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  CANCELLED: "Đã hủy",
};

export const ORDER_STATUS_VI: Record<OrderStatus, string> = {
  PROCESSING: "Đang xử lý",
  SHIPPING: "Đang giao hàng",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
};

export const PAYMENT_METHOD_VI: Record<PaymentMethod, string> = {
  COD: "Thanh toán khi nhận hàng",
  VNPAY: "Thanh toán qua VNPAY",
};
