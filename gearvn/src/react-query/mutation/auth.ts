import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  LoginPayload,
  AuthModalType,
  RegisterPayload,
  ResetPasswordPayload,
  ForgotPasswordPayload,
} from "@/types/auth";
import { queryKeys } from "../query-keys";
import { USER_ROLE } from "@/config.global";
import { useRoleStore } from "@/stores/use-role-store";
import { useCartStore } from "@/stores/use-cart-store";

import { toastError, toastSuccess } from "@/components/ui/toaster";

export const useLogin = (
  handleCloseDialog: () => void,
  setModal: (type: AuthModalType) => void
) => {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: LoginPayload) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      const response = await res.json();
      if (!res.ok) {
        if (res.status === 400) {
          throw { type: "verify-account", ...response };
        } else {
          throw response;
        }
      }

      return response;
    },

    onSuccess: (data) => {
      const { message, description, result } = data;

      handleCloseDialog();
      toastSuccess(message, description);

      if (result.role === USER_ROLE.ADMIN) {
        router.push("/admin/dashboard");
      } else {
        router.push("/");
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.user.me });
    },

    onError: (err: any) => {
      if (err.type === "verify-account") {
        setModal("verify-account");
      } else {
        toastError(err.message, err.description);
      }
    },
  });
};

export const useRegister = (setModal: (type: AuthModalType) => void) => {
  return useMutation({
    mutationFn: async (data: RegisterPayload) => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const response = await res.json();
      if (!res.ok) {
        throw response;
      }

      return response;
    },

    onSuccess: (data) => {
      const { message, description } = data;
      setModal("verify-account");
      toastSuccess(message, description);
    },

    onError: (err: any) => {
      toastError(err.message, err.description);
    },
  });
};

export const useResetPassword = (setModal: (type: AuthModalType) => void) => {
  return useMutation({
    mutationFn: async (data: ResetPasswordPayload) => {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const response = await res.json();
      if (!res.ok) {
        throw response;
      }

      return response;
    },

    onSuccess: (data) => {
      const { message, description } = data;
      toastSuccess(message, description);
      setModal("login");
    },

    onError: (err: any) => {
      toastError(err.message, err.description);
    },
  });
};

export const useForgotPassword = (setModal: (type: AuthModalType) => void) => {
  return useMutation({
    mutationFn: async (data: ForgotPasswordPayload) => {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const response = await res.json();
      if (!res.ok) {
        throw response;
      }

      return response;
    },

    onSuccess: (data) => {
      const { message, description } = data;
      toastSuccess(message, description);
      setModal("verify-account");
    },

    onError: (err: any) => {
      toastError(err.message, err.description);
    },
  });
};

export const useLogout = () => {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { clearCart } = useCartStore();
  const { clearRole } = useRoleStore();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw data;
      return data;
    },

    onSuccess: (data) => {
      const { message, description } = data;
      toastSuccess(message, description);

      clearCart();
      queryClient.clear();
      router.replace("/");
      clearRole();
    },

    onError: (err: any) => {
      toastError(err.message, err.description);
    },
  });
};
