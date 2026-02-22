import { queryKeys } from "@/react-query/query-keys";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  CreateUserPayload,
  EditUserPayload,
  UserRole,
} from "@/types/user";

import { getCsrfHeaders } from "@/utils/api/csrf";
import { toastError, toastSuccess } from "@/components/ui/toaster";

type GovernanceMutationOptions = {
  showToast?: boolean;
  onSuccessCallback?: () => void;
};

type StaffPayload = CreateUserPayload & {
  role: Exclude<UserRole, "ADMIN" | "CUSTOMER" | "MANAGER">;
};

type UpdateStaffPayload = {
  id: string;
  fullName?: string;
  phone?: string;
  address?: string;
  role?: StaffPayload["role"];
};

type AccountStatusPayload = {
  userId: string;
  status: string;
  reason: string;
};

type BanAccountPayload = {
  userId: string;
  reason: string;
};

type DeleteAccountPayload = {
  userId: string;
  reason: string;
};

export type UpdateSystemConfigPayload = {
  key: string;
  value: unknown;
  description?: string;
  reason: string;
};

const readResponse = async (res: Response) => {
  const response = await res.json();
  if (!res.ok) throw response;
  return response;
};

const handleSuccess = (
  data: any,
  onSuccessCallback?: () => void,
  showToast = true
) => {
  if (showToast) toastSuccess(data.message, data.description);
  onSuccessCallback?.();
};

const handleError = (err: any) => {
  toastError(err?.message, err?.description);
};

export const useCreateUser = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateUserPayload) => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCsrfHeaders() },
        body: JSON.stringify(data),
      });

      return readResponse(res);
    },

    onSuccess: (data) => {
      handleSuccess(data, onSuccessCallback);
      queryClient.invalidateQueries({ queryKey: queryKeys.user.root });
    },

    onError: handleError,
  });
};

export const useCreateManager = (
  onSuccessCallback?: () => void,
  options: GovernanceMutationOptions = {}
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateUserPayload) => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCsrfHeaders() },
        body: JSON.stringify({ ...data, role: "MANAGER" }),
      });

      return readResponse(res);
    },

    onSuccess: (data) => {
      handleSuccess(
        data,
        options.onSuccessCallback ?? onSuccessCallback,
        options.showToast
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.user.root });
    },

    onError: handleError,
  });
};

export const useCreateStaff = (
  onSuccessCallback?: () => void,
  options: GovernanceMutationOptions = {}
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: StaffPayload) => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCsrfHeaders() },
        body: JSON.stringify(data),
      });

      return readResponse(res);
    },

    onSuccess: (data) => {
      handleSuccess(
        data,
        options.onSuccessCallback ?? onSuccessCallback,
        options.showToast
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.user.root });
    },

    onError: handleError,
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
        headers: getCsrfHeaders(),
        body: formData,
      });

      return readResponse(res);
    },

    onSuccess: (data) => {
      handleSuccess(data, onSuccessCallback);
      queryClient.invalidateQueries({ queryKey: queryKeys.user.root });
    },

    onError: handleError,
  });
};

export const useUpdateStaff = (
  onSuccessCallback?: () => void,
  options: GovernanceMutationOptions = {}
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateStaffPayload) => {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCsrfHeaders() },
        body: JSON.stringify(data),
      });

      return readResponse(res);
    },

    onSuccess: (data) => {
      handleSuccess(
        data,
        options.onSuccessCallback ?? onSuccessCallback,
        options.showToast
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.user.root });
    },

    onError: handleError,
  });
};

export const useDeleteUser = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
        headers: getCsrfHeaders(),
      });

      return readResponse(res);
    },

    onSuccess: (data) => {
      handleSuccess(data, onSuccessCallback);
      queryClient.invalidateQueries({ queryKey: queryKeys.user.root });
    },

    onError: handleError,
  });
};

export const useDeleteAccount = (
  onSuccessCallback?: () => void,
  options: GovernanceMutationOptions = {}
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, reason }: DeleteAccountPayload) => {
      const res = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...getCsrfHeaders() },
        body: JSON.stringify({ reason }),
      });

      return readResponse(res);
    },

    onSuccess: (data) => {
      handleSuccess(
        data,
        options.onSuccessCallback ?? onSuccessCallback,
        options.showToast
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.user.root });
    },

    onError: handleError,
  });
};

export const useBanUser = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, reason }: BanAccountPayload) => {
      const res = await fetch(`/api/users/status/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCsrfHeaders() },
        body: JSON.stringify({ status: "BANNED", reason }),
      });

      return readResponse(res);
    },

    onSuccess: (data) => {
      handleSuccess(data, onSuccessCallback);
      queryClient.invalidateQueries({ queryKey: queryKeys.user.root });
    },

    onError: handleError,
  });
};

export const useUpdateAccountStatus = (
  onSuccessCallback?: () => void,
  options: GovernanceMutationOptions = {}
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, status, reason }: AccountStatusPayload) => {
      const res = await fetch(`/api/users/status/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCsrfHeaders() },
        body: JSON.stringify({ status, reason }),
      });

      return readResponse(res);
    },

    onSuccess: (data) => {
      handleSuccess(
        data,
        options.onSuccessCallback ?? onSuccessCallback,
        options.showToast
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.user.root });
    },

    onError: handleError,
  });
};

export const useUpdateSystemConfig = (
  onSuccessCallback?: () => void,
  options: GovernanceMutationOptions = {}
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, ...data }: UpdateSystemConfigPayload) => {
      const res = await fetch(`/api/system-config/${encodeURIComponent(key)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCsrfHeaders() },
        body: JSON.stringify(data),
      });

      return readResponse(res);
    },

    onSuccess: (data) => {
      handleSuccess(
        data,
        options.onSuccessCallback ?? onSuccessCallback,
        options.showToast
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.systemConfig.root });
    },

    onError: handleError,
  });
};
