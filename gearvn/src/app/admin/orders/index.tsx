"use client";

import { Suspense } from "react";

import { OrdersPage } from "./_components";

export function PageClient() {
  return (
    <Suspense>
      <OrdersPage />
    </Suspense>
  );
}
