"use client";

import { Suspense } from "react";

import { useResetPassword } from "@/hooks/use-reset-password";
import { useEmailVerification } from "@/hooks/use-email-verification";

const AuthToken = ({ children }: { children: React.ReactNode }) => {
  useResetPassword();
  useEmailVerification();

  return <>{children}</>;
};

export const AuthTokenGuard = ({ children }: { children: React.ReactNode }) => {
  return (
    <Suspense>
      <AuthToken>{children}</AuthToken>
    </Suspense>
  );
};
