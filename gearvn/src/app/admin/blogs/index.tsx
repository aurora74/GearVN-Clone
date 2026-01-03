"use client";

import { Suspense } from "react";

import { BlogsPage } from "./_components";

export function PageClient() {
  return (
    <Suspense>
      <BlogsPage />
    </Suspense>
  );
}
