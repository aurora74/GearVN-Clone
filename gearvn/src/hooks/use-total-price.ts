import { useMemo } from "react";

import { CartItemType } from "@/types/order";

export const useTotalPrice = (items: CartItemType[]) => {
  return useMemo(() => {
    return items.reduce((total, { price, discountPercent = 0, quantity }) => {
      const finalPrice = price * (1 - discountPercent / 100);
      return total + finalPrice * quantity;
    }, 0);
  }, [items]);
};
