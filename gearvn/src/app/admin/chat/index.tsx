"use client";

import { Suspense } from "react";

import { ChatPage } from "./_components";

export function PageClient() {
  return (
    <Suspense>
      <ChatPage />
    </Suspense>
  );
}
