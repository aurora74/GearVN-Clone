import { create } from "zustand";

import type { CreateOrderDraft } from "@/types/order";

export type OrderTypeStore = CreateOrderDraft & {
  totalAmount: number;
};

type VoucherState = {
  voucherCode?: string;
  voucherDiscountAmount?: number;
  voucherDescription?: string;
  voucherAppliedSubtotal?: number;
};

type OrderStore = VoucherState & {
  order: OrderTypeStore | null;

  clearOrder: () => void;
  setOrder: (order: OrderTypeStore) => void;
  setVoucher: (voucher: Required<VoucherState>) => void;
  clearVoucher: () => void;
};

export const useOrderStore = create<OrderStore>((set) => ({
  order: null,
  voucherCode: undefined,
  voucherDiscountAmount: undefined,
  voucherDescription: undefined,
  voucherAppliedSubtotal: undefined,

  setOrder: (order) => set({ order }),
  clearOrder: () =>
    set({
      order: null,
      voucherCode: undefined,
      voucherDiscountAmount: undefined,
      voucherDescription: undefined,
      voucherAppliedSubtotal: undefined,
    }),
  setVoucher: ({
    voucherCode,
    voucherDiscountAmount,
    voucherDescription,
    voucherAppliedSubtotal,
  }) =>
    set((state) => ({
      voucherCode,
      voucherDiscountAmount,
      voucherDescription,
      voucherAppliedSubtotal,
      order: state.order ? { ...state.order, voucherCode } : state.order,
    })),
  clearVoucher: () =>
    set((state) => ({
      voucherCode: undefined,
      voucherDiscountAmount: undefined,
      voucherDescription: undefined,
      voucherAppliedSubtotal: undefined,
      order: state.order ? { ...state.order, voucherCode: undefined } : state.order,
    })),
}));
