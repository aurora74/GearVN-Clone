import { useMutation, useQueryClient } from "@tanstack/react-query";

import { CreatePaymentPayload } from "@/types/payment";
import { getCsrfHeaders } from "@/utils/api/csrf";
import { queryKeys } from "../query-keys";

import { toastError } from "@/components/ui/toaster";

type CreatePaymentResult = {
  paymentUrl?: string;
};

type PaymentMutationError = {
  description?: string;
};

type CreatePaymentOptions = {
  onSuccess?: (data: CreatePaymentResult) => void;
  onError?: (error: PaymentMutationError) => void;
};

export const useCreatePayment = (options?: CreatePaymentOptions) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreatePaymentPayload) => {
      const response = await fetch("/api/payment/vnpay/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCsrfHeaders() },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw data;

      return data.result as CreatePaymentResult;
    },

    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.order?.root ?? [] });
      options?.onSuccess?.(data);

      if (data?.paymentUrl) {
        window.location.href = data.paymentUrl;
      }
    },

    onError: (err: PaymentMutationError) => {
      toastError("Tạo thanh toán thất bại", err.description || "Đã có lỗi xảy ra.");
      options?.onError?.(err);
    },
  });
};
