import { queryKeys } from "@/react-query/query-keys";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { CreateUserPayload, EditUserPayload } from "@/types/user";

import { toastError, toastSuccess } from "@/components/ui/toaster";

export const useCreateUser = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateUserPayload) => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const response = await res.json();
      if (!res.ok) throw response;

      return response;
    },

    onSuccess: (data) => {
      toastSuccess(data.message, data.description);
      queryClient.invalidateQueries({ queryKey: queryKeys.user.root });
      onSuccessCallback?.();
    },

    onError: (err: any) => {
      toastError(err?.message, err?.description);
    },
  });
};

export const useEditUser = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: EditUserPayload) => {
      const formData = new FormData();

      if (data.email) formData.append("email", data.email);
      if (data.phone) formData.append("phone", data.phone);
      if (data.address) formData.append("address", data.address);
      if (data.fullName) formData.append("fullName", data.fullName);

      if (data.avatar && data.avatar instanceof File) {
        formData.append("avatar", data.avatar);
      }

      const res = await fetch(`/api/users/${data.id}`, {
        method: "PUT",
        body: formData,
      });

      const response = await res.json();
      if (!res.ok) throw response;

      return response;
    },

    onSuccess: (data) => {
      toastSuccess(data.message, data.description);
      queryClient.invalidateQueries({ queryKey: queryKeys.user.root });
      onSuccessCallback?.();
    },

    onError: (err: any) => {
      toastError(err.message, err.description);
    },
  });
};

export const useDeleteUser = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      });

      const response = await res.json();
      if (!res.ok) throw response;

      return response;
    },

    onSuccess: (data) => {
      toastSuccess(data.message, data.description);
      queryClient.invalidateQueries({ queryKey: queryKeys.user.root });
      onSuccessCallback?.();
    },

    onError: (err: any) => {
      toastError(err?.message, err?.description);
    },
  });
};

export const useBanUser = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/users/status/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "BANNED" }),
      });

      const response = await res.json();
      if (!res.ok) throw response;

      return response;
    },

    onSuccess: (data) => {
      toastSuccess(data.message, data.description);
      queryClient.invalidateQueries({ queryKey: queryKeys.user.root });
      onSuccessCallback?.();
    },

    onError: (err: any) => {
      toastError(err?.message, err?.description);
    },
  });
};
