"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

import { useCartStore } from "@/stores/use-cart-store";
import { useCheckoutStepStore } from "@/stores/use-checkout-step";

type Props = { children: React.ReactNode };

export const StepGuard = ({ children }: Props) => {
  const searchParams = useSearchParams();

  const { clearCart } = useCartStore();
  const { setStep } = useCheckoutStepStore();

  useEffect(() => {
    const status = searchParams.get("status");

    if (status) setStep("complete");
    if (status === "success") clearCart();
  }, [searchParams, setStep, clearCart]);

  return <>{children}</>;
};
