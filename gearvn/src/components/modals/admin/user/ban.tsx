"use client";

import { useState } from "react";

import { Loader } from "lucide-react";

import { User } from "@/types/user";
import { useBanUser } from "@/react-query/mutation/user";

import {
  Dialog,
  DialogTitle,
  DialogHeader,
  DialogFooter,
  DialogContent,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
type ModalBanUserProps = {
  user: User;
  children: React.ReactNode;
  setOpenDropdown: (open: boolean) => void;
};

export const ModalBanUser = ({
  user,
  children,
  setOpenDropdown,
}: ModalBanUserProps) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const trimmedReason = reason.trim();

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setReason("");
  };

  const { mutate, isPending } = useBanUser(() => {
    handleOpenChange(false);
    setOpenDropdown(false);
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl text-red-600">
            Xác nhận khóa tài khoản
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Hành động này sẽ{" "}
            <span className="text-red-600 font-semibold">
              ngăn người dùng đăng nhập
            </span>{" "}
            vào hệ thống. Bạn có chắc chắn muốn khóa tài khoản của{" "}
            <span className="font-medium text-black">{user.fullName}</span>{" "}
            không?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-sm font-semibold" htmlFor={`ban-reason-${user._id}`}>
            Lý do
          </label>
          <Textarea
            id={`ban-reason-${user._id}`}
            value={reason}
            disabled={isPending}
            placeholder="Nhập lý do để ghi nhận vào audit log."
            onChange={(event) => setReason(event.target.value)}
          />
        </div>

        <DialogFooter className="flex justify-end gap-3 mt-6">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => handleOpenChange(false)}
          >
            Huỷ
          </Button>

          <Button
            variant="destructive"
            disabled={isPending || !trimmedReason}
            onClick={() => mutate({ userId: user._id, reason: trimmedReason })}
          >
            {isPending && <Loader className="size-4 animate-spin" />}
            Khóa ngay
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
