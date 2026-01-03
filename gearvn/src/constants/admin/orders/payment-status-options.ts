import { PaymentStatusType } from "@/types/order";

export const PAYMENT_STATUS_OPTIONS: {
  value: PaymentStatusType;
  label: string;
}[] = [
  { value: "PAID", label: "Đã thanh toán" },
  { value: "PENDING", label: "Chờ thanh toán" },
  { value: "CANCELLED", label: "Đã hủy" },
];
