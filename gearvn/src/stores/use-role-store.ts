import { create } from "zustand";
import { persist } from "zustand/middleware";

import { UserRole } from "@/types/user";
import { encryptedStorage } from "@/utils/encrypted-storage";

type RoleState = {
  role: UserRole | null;

  setRole: (role: UserRole) => void;
  clearRole: () => void;
};

export const useRoleStore = create<RoleState>()(
  persist(
    (set) => ({
      role: null,

      setRole: (role) => set({ role }),
      clearRole: () => set({ role: null }),
    }),
    {
      name: "user-role",
      storage: encryptedStorage,
    }
  )
);
