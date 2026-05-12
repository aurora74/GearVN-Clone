import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "../query-keys";
import { USER_ROLES } from "@/config.global";
import { useCartStore } from "@/stores/use-cart-store";
import { useRoleStore } from "@/stores/use-role-store";

import { User, UserRole, UseUsersParams } from "@/types/user";
import { PaginatedResponse } from "@/types/global";

export type SystemConfig = {
  _id?: string;
  key: string;
  value: unknown;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
};

export const useMe = () => {
  const { setRole, clearRole } = useRoleStore();

  return useQuery<User | null>({
    queryKey: queryKeys.user.me,

    queryFn: async () => {
      try {
        const response = await fetch("/api/users/me", {
          credentials: "include",
        });

        const data = await response.json();
        const user = data.result || null;

        useCartStore.getState().syncOwner(user?._id ?? null);

        if (USER_ROLES.includes(user?.role as UserRole)) {
          setRole(user.role);
        } else {
          clearRole();
        }

        return user;
      } catch {
        useCartStore.getState().syncOwner(null);
        clearRole();
        return null;
      }
    },
  });
};

export const useUsers = (params: UseUsersParams = { page: 1, limit: 20 }) =>
  useQuery<PaginatedResponse<User>>({
    queryKey: queryKeys.user.list(params),
    queryFn: async () => {
      const query = new URLSearchParams(
        Object.fromEntries(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])
        )
      );

      const response = await fetch(`/api/users?${query}`, {
        credentials: "include",
      });

      const { result } = await response.json();
      return result;
    },
  });

export const useStaffUsers = (params: UseUsersParams = { page: 1, limit: 20 }) =>
  useQuery<PaginatedResponse<User>>({
    queryKey: queryKeys.user.staff(params),
    queryFn: async () => {
      const query = new URLSearchParams(
        Object.fromEntries(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])
        )
      );

      const response = await fetch(`/api/users/staff?${query}`, {
        credentials: "include",
      });

      const { result } = await response.json();
      return result;
    },
  });

export const useSystemConfig = () =>
  useQuery<SystemConfig[]>({
    queryKey: queryKeys.systemConfig.list,
    queryFn: async () => {
      const response = await fetch("/api/system-config", {
        credentials: "include",
      });

      const data = await response.json();
      if (!response.ok) throw data;

      return data.result;
    },
  });
