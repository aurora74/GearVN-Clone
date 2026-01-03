import { create } from "zustand";

export type CheckoutStep = "cart" | "order-info" | "payment" | "complete";

const steps: CheckoutStep[] = ["cart", "order-info", "payment", "complete"];

type CheckoutStepStore = {
  // --- State ---
  currentStep: CheckoutStep;

  // --- Actions ---
  setStep: (step: CheckoutStep) => void;
  nextStep: () => void;
  prevStep: () => void;
};

export const useCheckoutStepStore = create<CheckoutStepStore>((set, get) => ({
  // --- State ---
  currentStep: "cart",

  // --- Actions ---
  setStep: (step) => set({ currentStep: step }),

  nextStep: () => {
    const index = steps.indexOf(get().currentStep);
    if (index < steps.length - 1) {
      set({ currentStep: steps[index + 1] });
    }
  },

  prevStep: () => {
    const index = steps.indexOf(get().currentStep);
    if (index > 0) {
      set({ currentStep: steps[index - 1] });
    }
  },
}));
