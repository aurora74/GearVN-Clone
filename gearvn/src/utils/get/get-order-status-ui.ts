import { LucideIcon, Loader, Truck, CheckCircle2, XCircle } from "lucide-react";

import { OrderStatus } from "@/types/order";
import { ORDER_STATUS } from "@/config.global";

type StatusUI = {
  label: string;
  icon: LucideIcon;
  className: string;
};

export const getOrderStatusUI = (status: OrderStatus): StatusUI => {
  switch (status) {
    case ORDER_STATUS.PROCESSING:
      return {
        label: "Đang xử lý",
        icon: Loader,
        className: "text-yellow-500 animate-spin",
      };
    case ORDER_STATUS.SHIPPING:
      return {
        label: "Đang giao hàng",
        icon: Truck,
        className: "text-blue-500",
      };
    case ORDER_STATUS.COMPLETED:
      return {
        label: "Hoàn thành",
        icon: CheckCircle2,
        className: "text-green-500",
      };
    case ORDER_STATUS.CANCELLED:
      return {
        label: "Đã hủy",
        icon: XCircle,
        className: "text-red-500",
      };
    default:
      return {
        label: "Không xác định",
        icon: XCircle,
        className: "text-gray-500",
      };
  }
};
