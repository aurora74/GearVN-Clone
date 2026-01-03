"use client";

import { useState, useCallback } from "react";

import { Loader } from "lucide-react";

import { PAYMENT_METHOD } from "@/config.global";
import { useTotalPrice } from "@/hooks/use-total-price";
import { replaceUrlParams } from "@/utils/replace-url-params";

import { useCartStore } from "@/stores/use-cart-store";
import { useOrderStore } from "@/stores/use-order-store";
import { useCheckoutStepStore } from "@/stores/use-checkout-step";

import { useCreateOrder } from "@/react-query/mutation/order";
import { useCreatePayment } from "@/react-query/mutation/payment";

import { ShippingInfo } from "./shipping-info";
import { OrderPricing } from "./order-pricing";
import { PaymentOptions } from "./payment-options";

import { Button } from "@/components/ui/button";

export const PaymentStep = () => {
  const { order } = useOrderStore();
  const { setStep } = useCheckoutStepStore();
  const { items, clearCart } = useCartStore();

  const totalPrice = useTotalPrice(items);
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHOD.COD);

  const { mutate: createPayment } = useCreatePayment();

  const { mutate: createOrder, isPending } = useCreateOrder((order) => {
    switch (paymentMethod) {
      case PAYMENT_METHOD.COD: {
        setStep("complete");
        clearCart();
        replaceUrlParams({
          status: "success",
          orderId: btoa(order._id),
        });
        break;
      }

      case PAYMENT_METHOD.VNPAY: {
        createPayment({
          amount: totalPrice,
          orderId: order._id,
          orderInfo: `Thanh toán đơn hàng ${order.orderCode}`,
        });
        break;
      }
    }
  });

  const handlePayment = useCallback(() => {
    if (!order || !order.items.length || totalPrice <= 0) return;
    createOrder({ ...order, paymentMethod });
  }, [order, paymentMethod, totalPrice, createOrder]);

  return (
    <div className="space-y-6 pt-3">
      {order && <ShippingInfo order={order} />}

      <PaymentOptions
        isPending={isPending}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
      />

      <OrderPricing totalPrice={totalPrice} />

      <Button
        disabled={isPending}
        onClick={handlePayment}
        className="w-full h-12 text-lg mt-4 rounded-sm"
      >
        {isPending && <Loader className="size-4 animate-spin" />}
        Thanh toán ngay
      </Button>
    </div>
  );
};
