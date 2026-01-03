"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { useCheckoutStepStore } from "@/stores/use-checkout-step";

type Props = { children: React.ReactNode };

export const ResetStepGuard = ({ children }: Props) => {
  const pathname = usePathname();
  const prevPathRef = useRef<string | null>(null);

  const { setStep } = useCheckoutStepStore();

  useEffect(() => {
    const prevPath = prevPathRef.current;
    if (prevPath === "/cart" && pathname !== "/cart") {
      setStep("cart");
    }
    prevPathRef.current = pathname;
  }, [pathname, setStep]);

  return <>{children}</>;
};
