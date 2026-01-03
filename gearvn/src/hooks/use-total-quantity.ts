import { useMemo } from "react";

import { CartItemType } from "@/types/order";

export const useTotalQuantity = (items: CartItemType[]) => {
  return useMemo(() => {
    return items.reduce((total, item) => total + item.quantity, 0);
  }, [items]);
};
