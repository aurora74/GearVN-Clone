export type PaymentMethodTypes = "COD" | "VNPAY";

export type CreatePaymentPayload = {
  amount: number;
  orderId: string;
  orderInfo: string;
};
