import { useMutation } from "@tanstack/react-query";

import { CreatePaymentPayload } from "@/types/payment";

import { toastError } from "@/components/ui/toaster";

export const useCreatePayment = () => {
  return useMutation({
    mutationFn: async (payload: CreatePaymentPayload) => {
      const response = await fetch("/api/payment/vnpay/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const { result } = await response.json();
      if (!response.ok) throw response;

      return result;
    },

    onSuccess: (data) => {
      if (data?.paymentUrl) {
        window.location.href = data.paymentUrl;
      }
    },

    onError: () => {
      toastError("Tạo thanh toán thất bại", "Đã có lỗi xảy ra.");
    },
  });
};
