"use client";

import { StepContent } from "./step-content";
import { CheckoutSteps } from "./checkout-step";
import { Card, CardContent } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/global/breadcrumbs";
import { Suspense } from "react";

const crumbs = [
  { label: "Trang chủ", href: "/" },
  { label: "Giỏ hàng", href: "/cart" },
];

export const CartPage = () => (
  <div className="bg-[#f7f8f9]">
    <Breadcrumbs items={crumbs} />
    <div className="max-w-[750px] pt-4 pb-12 mx-auto space-y-6">
      <Card className="shadow-sm rounded-sm">
        <CardContent className="py-6 px-3 sm:p-6 space-y-4">
          <CheckoutSteps />
          <Suspense>
            <StepContent />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  </div>
);
