"use client";

import { Suspense } from "react";

import { CustomersPage } from "./_components";

export function PageClient() {
  return (
    <Suspense>
      <CustomersPage />
    </Suspense>
  );
}
