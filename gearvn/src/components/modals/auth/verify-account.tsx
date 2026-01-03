"use client";

import { CheckCircle2 } from "lucide-react";

import { useAuthModal } from "@/stores/use-auth-modal";

import {
  Dialog,
  DialogTitle,
  DialogHeader,
  DialogContent,
  DialogDescription,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";

export const ModalVerifyAccount = () => {
  const { openModal, setModal } = useAuthModal();

  const handleClose = () => {
    setModal(null);
  };

  return (
    <Dialog open={openModal === "verify-account"} onOpenChange={handleClose}>
      <DialogContent className="">
        <div className="relative size-18 mx-auto flex items-center justify-center">
          <div className="absolute size-18 rounded-full bg-green-200 opacity-50 animate-ping" />
          <div className="absolute size-18 rounded-full border border-green-300" />
          <div className="relative size-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-sm">
            <CheckCircle2 className="size-10" />
          </div>
        </div>

        <DialogHeader className="mt-4 flex flex-col items-center gap-2">
          <DialogTitle className="text-2xl font-semibold text-foreground">
            Đã gửi email xác minh
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm leading-relaxed text-center">
            Vui lòng kiểm tra hộp thư đến hoặc mục thư rác để hoàn tất việc xác
            minh tài khoản của bạn.
          </DialogDescription>
        </DialogHeader>

        <Button
          onClick={handleClose}
          size="xl"
          className="w-full mt-4 font-medium rounded-sm"
        >
          Đóng
        </Button>
      </DialogContent>
    </Dialog>
  );
};
