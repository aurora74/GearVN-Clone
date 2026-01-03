import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "../query-keys";
import { USER_ROLE } from "@/config.global";
import { useRoleStore } from "@/stores/use-role-store";

import { User, UseUsersParams } from "@/types/user";
import { PaginatedResponse } from "@/types/global";

export const useMe = () => {
  const { setRole } = useRoleStore();

  return useQuery<User | null>({
    queryKey: queryKeys.user.me,

    queryFn: async () => {
      try {
        const response = await fetch("/api/users/me", {
          credentials: "include",
        });

        const data = await response.json();
        const user = data.result || null;

        if (
          user?.role === USER_ROLE.ADMIN ||
          user?.role === USER_ROLE.CUSTOMER
        ) {
          setRole(user.role);
        } else {
          setRole(null);
        }

        return user;
      } catch {
        setRole(null);
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
