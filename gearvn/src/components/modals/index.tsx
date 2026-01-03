"use client";

import { useAuthModal } from "@/stores/use-auth-modal";

import { ModalLogin } from "./auth/login";
import { ModalRegister } from "./auth/register";
import { ModalVerifyAccount } from "./auth/verify-account";
import { ModalResetPassword } from "./auth/reset-password";
import { ModalForgotPassword } from "./auth/forgot-password";

export const Modals = () => {
  const { openModal } = useAuthModal();

  return (
    <>
      {openModal === "login" && <ModalLogin />}
      {openModal === "register" && <ModalRegister />}
      {openModal === "forgot-password" && <ModalForgotPassword />}
      {openModal === "reset-password" && <ModalResetPassword />}
      {openModal === "verify-account" && <ModalVerifyAccount />}
    </>
  );
};
