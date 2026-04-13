import { QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "../query-keys";

import {
  CreateVoucherPayload,
  UpdateVoucherPayload,
} from "@/types/voucher";
import { toastError, toastSuccess } from "@/components/ui/toaster";
import { getCsrfHeaders } from "@/utils/api/csrf";

const invalidateVoucherCaches = (
  queryClient: QueryClient,
  voucherId?: string
) => {
  queryClient.invalidateQueries({ queryKey: queryKeys.voucher.root });
  queryClient.invalidateQueries({ queryKey: queryKeys.promotion.summary });

  if (voucherId) {
    queryClient.invalidateQueries({
      queryKey: queryKeys.voucher.detail(voucherId),
    });
  }
};

const mutationHeaders = () => ({
  "Content-Type": "application/json",
  ...getCsrfHeaders(),
});

const parseVoucherResponse = async (response: Response) => {
  const data = await response.json();
  if (!response.ok) throw data;
  return data;
};

export const useCreateVoucher = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateVoucherPayload) => {
      const response = await fetch("/api/vouchers", {
        method: "POST",
        headers: mutationHeaders(),
        credentials: "include",
        body: JSON.stringify(payload),
      });

      return parseVoucherResponse(response);
    },
    onSuccess: (data) => {
      toastSuccess(data.message, data.description);
      invalidateVoucherCaches(queryClient, data?.result?._id);
      onSuccessCallback?.();
    },
    onError: (err: any) => {
      toastError(err?.message, err?.description);
    },
  });
};

export const useUpdateVoucher = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateVoucherPayload) => {
      const response = await fetch(`/api/vouchers/${id}`, {
        method: "PATCH",
        headers: mutationHeaders(),
        credentials: "include",
        body: JSON.stringify(payload),
      });

      return parseVoucherResponse(response);
    },
    onSuccess: (data, variables) => {
      toastSuccess(data.message, data.description);
      invalidateVoucherCaches(queryClient, variables.id);
      onSuccessCallback?.();
    },
    onError: (err: any) => {
      toastError(err?.message, err?.description);
    },
  });
};

export const useEnableVoucher = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const response = await fetch(`/api/vouchers/${id}/enable`, {
        method: "PATCH",
        headers: mutationHeaders(),
        credentials: "include",
        body: JSON.stringify({ reason }),
      });

      return parseVoucherResponse(response);
    },
    onSuccess: (data, variables) => {
      toastSuccess(data.message, data.description);
      invalidateVoucherCaches(queryClient, variables.id);
      onSuccessCallback?.();
    },
    onError: (err: any) => {
      toastError(err?.message, err?.description);
    },
  });
};

export const useDisableVoucher = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const response = await fetch(`/api/vouchers/${id}/disable`, {
        method: "PATCH",
        headers: mutationHeaders(),
        credentials: "include",
        body: JSON.stringify({ reason }),
      });

      return parseVoucherResponse(response);
    },
    onSuccess: (data, variables) => {
      toastSuccess(data.message, data.description);
      invalidateVoucherCaches(queryClient, variables.id);
      onSuccessCallback?.();
    },
    onError: (err: any) => {
      toastError(err?.message, err?.description);
    },
  });
};

export const useDeleteVoucher = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const response = await fetch(`/api/vouchers/${id}`, {
        method: "DELETE",
        headers: mutationHeaders(),
        credentials: "include",
        body: JSON.stringify({ reason }),
      });

      return parseVoucherResponse(response);
    },
    onSuccess: (data, variables) => {
      toastSuccess(data.message, data.description);
      invalidateVoucherCaches(queryClient, variables.id);
      onSuccessCallback?.();
    },
    onError: (err: any) => {
      toastError(err?.message, err?.description);
    },
  });
};
