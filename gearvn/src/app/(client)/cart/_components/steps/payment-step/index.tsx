"use client";

import { useMemo, useState, useCallback, useEffect } from "react";

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
import { VoucherBox } from "./voucher-box";
import { Button } from "@/components/ui/button";

type CheckoutItemError = {
  productId?: string;
  requestedQuantity?: number;
  availableStock?: number;
  currentFinalPrice?: number;
  discountPercent?: number;
  promotionEligible?: boolean;
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
      warnings[item.productId] = `Tồn kho đã thay đổi: còn ${availableStock}, bạn đang chọn ${requestedQuantity}.`;
      return warnings;
    }

    warnings[item.productId] = "Sản phẩm không còn đủ số lượng đã chọn.";
    return warnings;
  }, {});
};

const buildPromotionWarnings = (
  items: CheckoutItemError[] | undefined
): Record<
  string,
  {
    message: string;
    currentFinalPrice?: number;
    discountPercent?: number;
    promotionEligible?: boolean;
  }
> => {
  if (!Array.isArray(items)) {
    return {};
  }

  return items.reduce<Record<string, {
    message: string;
    currentFinalPrice?: number;
    discountPercent?: number;
    promotionEligible?: boolean;
  }>>((warnings, item) => {
    if (!item.productId) {
      return warnings;
    }

    warnings[item.productId] = {
      message: item.promotionEligible === false
        ? "Khuyến mãi không còn áp dụng cho sản phẩm này. Vui lòng xem lại đơn hàng."
        : "Giá khuyến mãi đã thay đổi. Vui lòng xem lại đơn hàng trước khi thanh toán.",
      currentFinalPrice: item.currentFinalPrice,
      discountPercent: item.discountPercent,
      promotionEligible: item.promotionEligible,
    };

    return warnings;
  }, {});
};

export const PaymentStep = () => {
  const {
    order,
    voucherCode,
    voucherDiscountAmount = 0,
    voucherAppliedSubtotal,
    clearVoucher,
  } = useOrderStore();
  const { setStep } = useCheckoutStepStore();
  const {
    items,
    clearCart,
    setAvailabilityWarnings,
    clearAvailabilityWarnings,
    setPromotionWarnings,
    clearPromotionWarnings,
  } = useCartStore();

  const productSubtotal = useMemo(
    () => items.reduce((total, item) => total + item.finalPrice * item.quantity, 0),
    [items]
  );
  const originalSubtotal = useMemo(
    () => items.reduce((total, item) => total + item.price * item.quantity, 0),
    [items]
  );
  const productDiscountAmount = Math.max(0, originalSubtotal - productSubtotal);
  const totalPrice = useTotalPrice(items, voucherDiscountAmount);
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHOD.COD);

  useEffect(() => {
    if (
      voucherCode &&
      voucherAppliedSubtotal !== undefined &&
      voucherAppliedSubtotal !== productSubtotal
    ) {
      clearVoucher();
    }
  }, [voucherCode, voucherAppliedSubtotal, productSubtotal, clearVoucher]);

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
      clearPromotionWarnings();
      clearVoucher();

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
      if (error?.detail?.code === "CHECKOUT_STOCK_CHANGED") {
        const warnings = buildAvailabilityWarnings(error.detail.items);
        if (Object.keys(warnings).length === 0) {
          return;
        }

        setAvailabilityWarnings(warnings);
        setStep("cart");
        return;
      }

      if (error?.detail?.code === "CHECKOUT_PRICE_CHANGED") {
        const warnings = buildPromotionWarnings(error.detail.items);
        if (Object.keys(warnings).length === 0) {
          return;
        }

        setPromotionWarnings(warnings);
        setStep("cart");
      }
    },
  );

  const handlePayment = useCallback(() => {
    if (!order || !order.items.length || totalPrice <= 0) return;

    clearAvailabilityWarnings();
    clearPromotionWarnings();

    const checkoutDraft = Object.fromEntries(
      Object.entries(order).filter(([key]) => key !== "totalAmount"),
    ) as Omit<typeof order, "totalAmount">;

    createOrder({
      ...checkoutDraft,
      voucherCode,
      items: checkoutDraft.items.map((item) => {
        const cartItem = items.find((cartItem) => cartItem.id === item.productId);
        return {
          ...item,
          clientFinalPrice: cartItem?.finalPrice,
        };
      }),
      paymentMethod,
    });
  }, [
    order,
    voucherCode,
    items,
    paymentMethod,
    totalPrice,
    createOrder,
    clearAvailabilityWarnings,
    clearPromotionWarnings,
  ]);

  return (
    <div className="space-y-6 pt-3">
      {order && <ShippingInfo order={order} />}

      <PaymentOptions
        isPending={isPending}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
      />

      <VoucherBox subtotal={productSubtotal} />

      <OrderPricing
        subtotal={originalSubtotal}
        productDiscountAmount={productDiscountAmount}
        voucherDiscountAmount={voucherDiscountAmount}
        totalPrice={totalPrice}
      />

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
