"use client";

import { Suspense } from "react";

import { DashboardPage } from "./_components";

export function PageClient() {
  return (
    <Suspense>
      <DashboardPage />
    </Suspense>
  );
}
