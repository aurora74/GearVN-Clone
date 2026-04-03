import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  Order,
  CreateOrderPayload,
  UpdateOrderStatusPayload,
} from "@/types/order";
import { queryKeys } from "../query-keys";
import { getCsrfHeaders } from "@/utils/api/csrf";

import { toastError, toastSuccess } from "@/components/ui/toaster";

type OrderMutationError = {
  status?: number;
  message?: string;
  description?: string;
  detail?: {
    code?: string;
    items?: Array<Record<string, unknown>>;
    [key: string]: unknown;
  };
};

const normalizeOrderError = (data: OrderMutationError): OrderMutationError => {
  if (data.detail?.code === "CHECKOUT_PRICE_CHANGED") {
    return { ...data, detail: data.detail };
  }

  return data;
};

export const useCreateOrder = (
  onSuccessCallback?: (data: Order) => void,
  onErrorCallback?: (error: OrderMutationError) => void,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateOrderPayload) => {
      const requestBody: CreateOrderPayload = {
        fullName: payload.fullName,
        phone: payload.phone,
        address: payload.address,
        note: payload.note,
        voucherCode: payload.voucherCode,
        items: payload.items,
        paymentMethod: payload.paymentMethod,
      };

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCsrfHeaders() },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      if (!response.ok) throw normalizeOrderError(data);

      return data;
    },

    onSuccess: (data) => {
      toastSuccess(data.message, data.description);
      queryClient.invalidateQueries({ queryKey: queryKeys.order?.root ?? [] });
      onSuccessCallback?.(data.result);
    },

    onError: (err: OrderMutationError) => {
      toastError(
        err.message ?? "Đã có lỗi xảy ra",
        err.description ?? "Vui lòng thử lại sau.",
      );
      onErrorCallback?.(err);
    },
  });
};

export const useUpdateOrderStatus = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      status,
      cancellationReason,
    }: UpdateOrderStatusPayload) => {
      const response = await fetch(`/api/orders/status/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getCsrfHeaders() },
        body: JSON.stringify({ orderStatus: status, cancellationReason }),
      });

      const data = await response.json();
      if (!response.ok) throw data;

      return data;
    },

    onSuccess: (data) => {
      toastSuccess(data.message, data.description);
      queryClient.invalidateQueries({ queryKey: queryKeys.order?.root });
      onSuccessCallback?.();
    },

    onError: (err: OrderMutationError) => {
      toastError(
        err.message ?? "Đã có lỗi xảy ra",
        err.description ?? "Vui lòng thử lại sau.",
      );
    },
  });
};

export const useCancelOrder = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId }: { orderId: string }) => {
      const response = await fetch(`/api/orders/cancel/${orderId}`, {
        method: "PUT",
        headers: getCsrfHeaders(),
      });

      const data = await response.json();
      if (!response.ok) throw data;

      return data;
    },

    onSuccess: (data) => {
      toastSuccess(data.message, data.description);
      queryClient.invalidateQueries({ queryKey: queryKeys.order?.root });
      onSuccessCallback?.();
    },

    onError: (err: OrderMutationError) => {
      toastError(
        err.message ?? "Đã có lỗi xảy ra",
        err.description ?? "Vui lòng thử lại sau.",
      );
    },
  });
};
