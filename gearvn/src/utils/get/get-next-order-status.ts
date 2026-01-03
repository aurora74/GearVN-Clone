import { Truck, CheckCircle2, XCircle } from "lucide-react";

import { OrderStatus } from "@/types/order";

type NextStatusOption = {
  status: OrderStatus;
  label: string;
  icon: React.ElementType;
  color: string;
  background: string;
};

export const NEXT_STATUS_MAP: Record<OrderStatus, NextStatusOption[]> = {
  PROCESSING: [
    {
      status: "SHIPPING",
      label: "Đang giao",
      icon: Truck,
      color: "group-hover:text-blue-500",
      background: "hover:!bg-blue-500/10",
    },
    {
      status: "COMPLETED",
      label: "Hoàn thành",
      icon: CheckCircle2,
      color: "group-hover:text-green-500",
      background: "hover:!bg-green-500/10",
    },
    {
      status: "CANCELLED",
      label: "Hủy đơn",
      icon: XCircle,
      color: "group-hover:text-red-500",
      background: "hover:!bg-red-500/10",
    },
  ],
  SHIPPING: [
    {
      status: "COMPLETED",
      label: "Hoàn thành",
      icon: CheckCircle2,
      color: "group-hover:text-green-500",
      background: "hover:!bg-green-500/10",
    },
    {
      status: "CANCELLED",
      label: "Hủy đơn",
      icon: XCircle,
      color: "group-hover:text-red-500",
      background: "hover:!bg-red-500/10",
    },
  ],
  COMPLETED: [],
  CANCELLED: [],
};

export const getNextOrderStatus = (status: OrderStatus) =>
  NEXT_STATUS_MAP[status] || [];
