"use client";

import { StepKeyType } from "@/types/order";
import { useCheckoutStepStore } from "@/stores/use-checkout-step";

import { CartStep } from "./steps/cart-step";
import { PaymentStep } from "./steps/payment-step";
import { CompleteStep } from "./steps/complete-step";
import { OrderInfoStep } from "./steps/order-info-step";
import { StepGuard } from "@/components/guards/step-guard";

const stepComponents: Record<StepKeyType, React.FC> = {
  cart: CartStep,
  "order-info": OrderInfoStep,
  payment: PaymentStep,
  complete: CompleteStep,
};

export const StepContent = () => {
  const { currentStep } = useCheckoutStepStore();

  const StepComponent = stepComponents[currentStep as StepKeyType];

  return (
    <StepGuard>
      <StepComponent />
    </StepGuard>
  );
};
