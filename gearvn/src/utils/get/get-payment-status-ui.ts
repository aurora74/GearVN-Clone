import { LucideIcon, CheckCircle2, Loader, XCircle } from "lucide-react";

import { PAYMENT_STATUS } from "@/config.global";
import { PaymentStatusType } from "@/types/order";

type StatusUI = {
  label: string;
  icon: LucideIcon;
  className: string;
};

export const getPaymentStatusUI = (status: PaymentStatusType): StatusUI => {
  switch (status) {
    case PAYMENT_STATUS.PAID:
      return {
        label: "Đã thanh toán",
        icon: CheckCircle2,
        className: "text-green-500",
      };
    case PAYMENT_STATUS.PENDING:
      return {
        label: "Chờ thanh toán",
        icon: Loader,
        className: "text-yellow-500 animate-spin",
      };
    case PAYMENT_STATUS.CANCELLED:
    default:
      return {
        label: "Đã hủy",
        icon: XCircle,
        className: "text-red-500",
      };
  }
};
