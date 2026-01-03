"use client";

import { Suspense } from "react";

import { CategoriesPage } from "./_components";

export function PageClient() {
  return (
    <Suspense>
      <CategoriesPage />
    </Suspense>
  );
}
