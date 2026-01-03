import { create } from "zustand";

import { AuthModalType } from "@/types/auth";

type AuthModalStore = {
  openModal: AuthModalType | null;
  resetToken: string | null;

  setModal: (type: AuthModalType) => void;
  closeModal: () => void;

  setResetToken: (token: string | null) => void;
  clearResetToken: () => void;
};

export const useAuthModal = create<AuthModalStore>((set) => ({
  openModal: null,
  resetToken: null,

  setModal: (type) => set({ openModal: type }),
  closeModal: () => set({ openModal: null }),

  setResetToken: (token) => set({ resetToken: token }),
  clearResetToken: () => set({ resetToken: null }),
}));
