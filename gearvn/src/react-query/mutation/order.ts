import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  Order,
  CreateOrderPayload,
  UpdateOrderStatusPayload,
} from "@/types/order";
import { queryKeys } from "../query-keys";

import { toastError, toastSuccess } from "@/components/ui/toaster";

export const useCreateOrder = (onSuccessCallback?: (data: Order) => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateOrderPayload) => {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw response;

      return data;
    },

    onSuccess: (data) => {
      toastSuccess(data.message, data.description);
      queryClient.invalidateQueries({ queryKey: queryKeys.order?.root ?? [] });
      onSuccessCallback?.(data.result);
    },

    onError: (err: any) => {
      toastError(err.message, err.description);
    },
  });
};

export const useUpdateOrderStatus = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, status }: UpdateOrderStatusPayload) => {
      const response = await fetch(`/api/orders/status/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderStatus: status }),
      });

      const data = await response.json();
      if (!response.ok) throw response;

      return data;
    },

    onSuccess: (data) => {
      toastSuccess(data.message, data.description);
      queryClient.invalidateQueries({ queryKey: queryKeys.order?.root });
      onSuccessCallback?.();
    },

    onError: (err: any) => {
      toastError(err.message, err.description);
    },
  });
};

export const useCancelOrder = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId }: { orderId: string }) => {
      const response = await fetch(`/api/orders/cancel/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();
      if (!response.ok) throw response;

      return data;
    },

    onSuccess: (data) => {
      toastSuccess(data.message, data.description);
      queryClient.invalidateQueries({ queryKey: queryKeys.order?.root });
      onSuccessCallback?.();
    },

    onError: (err: any) => {
      toastError(err.message, err.description);
    },
  });
};
