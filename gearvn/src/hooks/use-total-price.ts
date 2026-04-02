import { useMemo } from "react";

import { CartItemType } from "@/types/order";

export const useTotalPrice = (
  items: CartItemType[],
  voucherDiscountAmount = 0
) => {
  return useMemo(() => {
    const productTotal = items.reduce((total, { finalPrice, quantity }) => {
      return total + finalPrice * quantity;
    }, 0);

    return Math.max(0, productTotal - voucherDiscountAmount);
  }, [items, voucherDiscountAmount]);
};
