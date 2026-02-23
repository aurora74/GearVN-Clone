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

type CheckoutItemError = {
  productId?: string;
  requestedQuantity?: number;
  availableStock?: number;
};

type CheckoutErrorDetail = {
  code?: string;
  items?: CheckoutItemError[];
};

type CheckoutError = {
  detail?: CheckoutErrorDetail;
};

const buildAvailabilityWarnings = (
  items: CheckoutItemError[] | undefined,
): Record<string, string> => {
  if (!Array.isArray(items)) {
    return {};
  }

  return items.reduce<Record<string, string>>((warnings, item) => {
    if (!item.productId) {
      return warnings;
    }

    const availableStock = Number(item.availableStock ?? 0);
    const requestedQuantity = Number(item.requestedQuantity ?? 0);

    if (Number.isFinite(availableStock) && Number.isFinite(requestedQuantity)) {
      warnings[item.productId] = `Ton kho thay doi: con ${availableStock}, ban dang chon ${requestedQuantity}.`;
      return warnings;
    }

    warnings[item.productId] = "San pham khong con du so luong da chon.";
    return warnings;
  }, {});
};

export const PaymentStep = () => {
  const { order } = useOrderStore();
  const { setStep } = useCheckoutStepStore();
  const {
    items,
    clearCart,
    setAvailabilityWarnings,
    clearAvailabilityWarnings,
  } = useCartStore();

  const totalPrice = useTotalPrice(items);
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHOD.COD);

  const { mutate: createPayment } = useCreatePayment({
    onSuccess: (data) => {
      if (data?.paymentUrl) {
        clearCart();
      }
    },
  });

  const { mutate: createOrder, isPending } = useCreateOrder(
    (createdOrder) => {
      clearAvailabilityWarnings();

      switch (paymentMethod) {
        case PAYMENT_METHOD.COD: {
          setStep("complete");
          clearCart();
          replaceUrlParams({
            status: "success",
            orderId: btoa(createdOrder._id),
          });
          break;
        }

        case PAYMENT_METHOD.VNPAY: {
          createPayment({
            orderId: createdOrder._id,
            orderInfo: `Thanh toán đơn hàng ${createdOrder.orderCode}`,
          });
          break;
        }
      }
    },
    (error: CheckoutError) => {
      if (error?.detail?.code !== "CHECKOUT_STOCK_CHANGED") {
        return;
      }

      const warnings = buildAvailabilityWarnings(error.detail.items);
      if (Object.keys(warnings).length === 0) {
        return;
      }

      setAvailabilityWarnings(warnings);
      setStep("cart");
    },
  );

  const handlePayment = useCallback(() => {
    if (!order || !order.items.length || totalPrice <= 0) return;

    clearAvailabilityWarnings();

    const checkoutDraft = Object.fromEntries(
      Object.entries(order).filter(([key]) => key !== "totalAmount"),
    ) as Omit<typeof order, "totalAmount">;

    createOrder({ ...checkoutDraft, paymentMethod });
  }, [order, paymentMethod, totalPrice, createOrder, clearAvailabilityWarnings]);

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
