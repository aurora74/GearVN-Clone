import { create } from "zustand";

import type { CreateOrderDraft } from "@/types/order";

export type OrderTypeStore = CreateOrderDraft & {
  totalAmount: number;
};

type OrderStore = {
  order: OrderTypeStore | null;

  clearOrder: () => void;
  setOrder: (order: OrderTypeStore) => void;
};

export const useOrderStore = create<OrderStore>((set) => ({
  order: null,

  setOrder: (order) => set({ order }),
  clearOrder: () => set({ order: null }),
}));
