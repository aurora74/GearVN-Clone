"use client";

import { Suspense } from "react";

import { CartPage } from "./_components";

export function PageClient() {
  return (
    <Suspense>
      <CartPage />
    </Suspense>
  );
}
