"use client";

import { ChevronLeft } from "lucide-react";

import { cn } from "@/utils/cn";
import { CHECKOUT_STEPS } from "@/constants/cart/checkout-steps";
import { useCheckoutStepStore } from "@/stores/use-checkout-step";

export const CheckoutSteps = () => {
  const { currentStep, prevStep } = useCheckoutStepStore();

  const currentIndex = CHECKOUT_STEPS.findIndex((s) => s.key === currentStep);

  const isBackVisible = currentIndex > 0;

  const getStepClass = (active: boolean, completed: boolean) =>
    cn(
      "flex items-center justify-center size-8 sm:size-10 border-1 rounded-full z-10 transition-colors duration-300",
      active
        ? "text-white bg-red-600 border-red-600"
        : completed
        ? "text-white border-primary bg-primary"
        : "text-[#999] border-[#999] bg-white"
    );

  const getLabelClass = (active: boolean, completed: boolean) =>
    cn(
      "text-[13px] sm:text-sm font-medium mt-1 text-center leading-tight transition-colors duration-300",
      active ? "text-red-600" : completed ? "text-primary" : "text-[#999]"
    );

  const getLineClass = (completed: boolean) =>
    cn(
      "absolute top-[16px] sm:top-[22px] right-0 w-full h-0.5 border-t-2 border-dashed translate-x-1/2 z-0 transition-colors duration-300",
      completed ? "border-primary" : "border-[#999]"
    );

  return (
    <div className="space-y-4 sm:space-y-6">
      {isBackVisible && (
        <div className="text-left">
          <button
            onClick={prevStep}
            className="flex items-center gap-2 text-base font-medium text-primary hover:underline cursor-pointer"
          >
            <ChevronLeft className="size-5" />
            Trở lại
          </button>
        </div>
      )}

      <div className="p-3 sm:p-6 bg-primary/10 rounded-sm">
        <div
          role="list"
          className="flex justify-between items-center gap-1 sm:gap-3"
        >
          {CHECKOUT_STEPS.map(({ key, label, icon: Icon }, index) => {
            const active = index === currentIndex;
            const completed = index < currentIndex;
            const last = index === CHECKOUT_STEPS.length - 1;

            return (
              <div
                key={key}
                role="listitem"
                aria-current={active ? "step" : undefined}
                className="relative flex-1 flex flex-col items-center px-1"
              >
                {!last && <div className={getLineClass(completed)} />}
                <div className={getStepClass(active, completed)}>
                  <Icon aria-hidden="true" strokeWidth={1.5} />
                </div>
                <span className={getLabelClass(active, completed)}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
