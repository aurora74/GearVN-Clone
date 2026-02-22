export type PaymentMethodTypes = "COD" | "VNPAY";

export type CreatePaymentPayload = {
  orderId: string;
  orderInfo: string;
};
