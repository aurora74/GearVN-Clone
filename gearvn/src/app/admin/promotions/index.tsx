"use client";

import { Suspense } from "react";

import { PromotionsPage } from "./_components";

export function PageClient() {
  return (
    <Suspense>
      <PromotionsPage />
    </Suspense>
  );
}
