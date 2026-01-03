"use client";

import { Suspense } from "react";

import { ProductsPage } from "./_components";

export function PageClient() {
  return (
    <Suspense>
      <ProductsPage />
    </Suspense>
  );
}
