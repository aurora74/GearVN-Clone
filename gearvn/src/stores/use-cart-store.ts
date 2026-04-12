import { create } from "zustand";
import { persist } from "zustand/middleware";

import { CartItemType } from "@/types/order";
import { encryptedStorage } from "@/utils/encrypted-storage";

type PromotionWarning = {
  message: string;
  currentFinalPrice?: number;
  discountPercent?: number;
  promotionEligible?: boolean;
};

type CartState = {
  // --- State ---
  items: CartItemType[];
  justAddedItem: boolean;

  // --- Actions ---
  addToCart: (item: CartItemType) => void;
  removeFromCart: (id: string) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;

  updateQuantity: (id: string, quantity: number) => void;
  increaseQuantity: (id: string) => void;
  decreaseQuantity: (id: string) => void;

  setAvailabilityWarnings: (warnings: Record<string, string>) => void;
  clearAvailabilityWarnings: () => void;
  setPromotionWarnings: (warnings: Record<string, PromotionWarning>) => void;
  clearPromotionWarnings: () => void;
  clearJustAdded: () => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      // --- State ---
      items: [],
      justAddedItem: false,

      // --- Actions ---
      addToCart: (item) => {
        const existing = get().items.find((i) => i.id === item.id);

        if (existing) {
          set({
            items: get().items.map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    ...item,
                    quantity: i.quantity + item.quantity,
                    availabilityWarning: undefined,
                    promotionWarning: undefined,
                    voucherWarning: undefined,
                  }
                : i
            ),
            justAddedItem: false,
          });
        } else {
          set({
            items: [
              ...get().items,
              {
                ...item,
                availabilityWarning: undefined,
                promotionWarning: undefined,
                voucherWarning: undefined,
              },
            ],
            justAddedItem: false,
          });
        }

        setTimeout(() => set({ justAddedItem: true }), 0);
      },

      removeFromCart: (id) =>
        set({ items: get().items.filter((i) => i.id !== id) }),

      removeItem: (id) => get().removeFromCart(id),

      clearCart: () => set({ items: [] }),

      updateQuantity: (id, quantity) => {
        if (quantity <= 0) {
          get().removeFromCart(id);
        } else {
          set({
            items: get().items.map((i) =>
              i.id === id
                ? {
                    ...i,
                    quantity,
                    availabilityWarning: undefined,
                    promotionWarning: undefined,
                    voucherWarning: undefined,
                  }
                : i
            ),
          });
        }
      },

      increaseQuantity: (id) => {
        const item = get().items.find((i) => i.id === id);
        if (item) get().updateQuantity(id, item.quantity + 1);
      },

      decreaseQuantity: (id) => {
        const item = get().items.find((i) => i.id === id);
        if (item) get().updateQuantity(id, item.quantity - 1);
      },

      setAvailabilityWarnings: (warnings) => {
        set({
          items: get().items.map((item) => ({
            ...item,
            availabilityWarning: warnings[item.id],
          })),
        });
      },

      clearAvailabilityWarnings: () => {
        set({
          items: get().items.map((item) => ({
            ...item,
            availabilityWarning: undefined,
          })),
        });
      },

      setPromotionWarnings: (warnings) => {
        set({
          items: get().items.map((item) => {
            const warning = warnings[item.id];
            if (!warning) {
              return { ...item, promotionWarning: undefined };
            }

            return {
              ...item,
              finalPrice: warning.currentFinalPrice ?? item.finalPrice,
              clientFinalPrice: warning.currentFinalPrice ?? item.clientFinalPrice,
              discountPercent: warning.discountPercent ?? item.discountPercent,
              promotionWarning: warning.message,
            };
          }),
        });
      },

      clearPromotionWarnings: () => {
        set({
          items: get().items.map((item) => ({
            ...item,
            promotionWarning: undefined,
            voucherWarning: undefined,
          })),
        });
      },

      clearJustAdded: () => set({ justAddedItem: false }),
    }),

    {
      name: "cart-storage",
      storage: encryptedStorage,
      partialize: (state) => ({ items: state.items }),
    }
  )
);
