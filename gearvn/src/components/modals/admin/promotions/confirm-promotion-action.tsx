"use client";

import { useState } from "react";

import { Loader } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const FLASH_SALE_END_CONFIRMATION =
  "Khuyến mãi này sẽ ngừng áp dụng cho các lượt mua mới. Đơn hàng đã tạo vẫn giữ snapshot khuyến mãi.";
export const VOUCHER_DISABLE_CONFIRMATION =
  "Mã này sẽ không thể áp dụng cho đơn hàng mới. Lượt dùng đã ghi nhận không thay đổi.";
export const IRREVERSIBLE_CONFIRMATION = "Hành động này không thể hoàn tác.";

type ConfirmPromotionActionProps = {
  title: string;
  description: string;
  confirmLabel: string;
  children: React.ReactNode;
  isPending?: boolean;
  onConfirm: (reason: string) => void;
  onClose?: () => void;
};

export const ConfirmPromotionAction = ({
  title,
  description,
  confirmLabel,
  children,
  isPending,
  onConfirm,
  onClose,
}: ConfirmPromotionActionProps) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setReason("");
      onClose?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-destructive">{title}</DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block">{description}</span>
            <span className="block">{IRREVERSIBLE_CONFIRMATION}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-semibold" htmlFor="promotion-reason">
            Lý do
          </label>
          <Textarea
            id="promotion-reason"
            value={reason}
            disabled={isPending}
            placeholder="Nhập lý do để ghi nhận audit"
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => handleOpenChange(false)}
          >
            Huỷ
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={() => onConfirm(reason)}
          >
            {isPending && <Loader className="size-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
