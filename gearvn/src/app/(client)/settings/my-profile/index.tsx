"use client";

import { Suspense } from "react";

import { MyProfilePage } from "./_components";

export function PageClient() {
  return (
    <Suspense>
      <MyProfilePage />
    </Suspense>
  );
}
