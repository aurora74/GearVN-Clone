"use client";

import { Suspense } from "react";

import { EventsPage } from "./_components";

export function PageClient() {
  return (
    <Suspense>
      <EventsPage />
    </Suspense>
  );
}
