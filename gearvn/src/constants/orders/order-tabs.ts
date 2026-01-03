import { ORDER_STATUS } from "@/config.global";

export const ORDER_TABS = [
  { value: "tat-ca", label: "Tất cả", status: undefined },
  { value: "dang-xu-ly", label: "Đang xử lý", status: ORDER_STATUS.PROCESSING },
  {
    value: "dang-van-chuyen",
    label: "Đang vận chuyển",
    status: ORDER_STATUS.SHIPPING,
  },
  { value: "hoan-thanh", label: "Hoàn thành", status: ORDER_STATUS.COMPLETED },
  { value: "huy", label: "Hủy", status: ORDER_STATUS.CANCELLED },
];
