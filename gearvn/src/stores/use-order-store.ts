import { create } from "zustand";

type OrderItem = {
  quantity: number;
  productId: string;
};

export type OrderTypeStore = {
  note?: string;
  phone: string;
  address: string;
  fullName: string;
  items: OrderItem[];
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
