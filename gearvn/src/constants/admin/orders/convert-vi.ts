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

export const ORDER_EVENT_TYPE_VI: Record<string, string> = {
  ORDER_STATUS_CHANGED: "Cập nhật trạng thái đơn hàng",
};

export const ORDER_DISPLAY_FALLBACK = "Đã có lỗi xảy ra. Vui lòng thử lại sau.";

export const getOrderStatusVi = (status?: string) =>
  status ? ORDER_STATUS_VI[status] ?? ORDER_DISPLAY_FALLBACK : ORDER_DISPLAY_FALLBACK;

export const getOrderEventTypeVi = (type?: string) =>
  type ? ORDER_EVENT_TYPE_VI[type] ?? ORDER_DISPLAY_FALLBACK : ORDER_DISPLAY_FALLBACK;

export const PAYMENT_METHOD_VI: Record<PaymentMethod, string> = {
  COD: "Thanh toán khi nhận hàng",
  VNPAY: "Thanh toán qua VNPAY",
};
