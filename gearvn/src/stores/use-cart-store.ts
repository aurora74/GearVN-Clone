import { create } from "zustand";
import { persist } from "zustand/middleware";

import { CartItemType } from "@/types/order";
import { encryptedStorage } from "@/utils/encrypted-storage";

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
                    quantity: i.quantity + item.quantity,
                    availabilityWarning: undefined,
                  }
                : i
            ),
            justAddedItem: false,
          });
        } else {
          set({
            items: [...get().items, { ...item, availabilityWarning: undefined }],
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
              i.id === id ? { ...i, quantity, availabilityWarning: undefined } : i
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

      clearJustAdded: () => set({ justAddedItem: false }),
    }),

    {
      name: "cart-storage",
      storage: encryptedStorage,
      partialize: (state) => ({ items: state.items }),
    }
  )
);
