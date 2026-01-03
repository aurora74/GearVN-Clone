import {
  CreditCard,
  ShieldCheck,
  NotebookPen,
  ShoppingCart,
} from "lucide-react";

export const CHECKOUT_STEPS = [
  {
    key: "cart",
    label: "Giỏ hàng",
    icon: ShoppingCart,
  },
  {
    key: "order-info",
    label: "Thông tin",
    icon: NotebookPen,
  },
  {
    key: "payment",
    label: "Thanh toán",
    icon: CreditCard,
  },
  {
    key: "complete",
    label: "Hoàn tất",
    icon: ShieldCheck,
  },
] as const;
