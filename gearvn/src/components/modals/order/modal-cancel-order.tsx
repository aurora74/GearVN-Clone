"use client";

import { useState } from "react";
import { Loader } from "lucide-react";

import { Order } from "@/types/order";
import { useCancelOrder } from "@/react-query/mutation/order";

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

type Props = {
  order: Order;
  children: React.ReactNode;
};

type CancelOrderError = {
  message?: string;
  description?: string;
};

export const ModalCancelOrder = ({ order, children }: Props) => {
  const [open, setOpen] = useState(false);
  const [denyMessage, setDenyMessage] = useState<string | null>(null);

  const { mutate: cancelOrder, isPending } = useCancelOrder();

  const handleCancel = () => {
    cancelOrder(
      { orderId: order._id },
      {
        onSuccess: () => {
          setDenyMessage(null);
          setOpen(false);
        },
        onError: (err: CancelOrderError) => {
          setDenyMessage(
            err.description ||
              err.message ||
              "Không thể hủy đơn hàng ở trạng thái hiện tại."
          );
        },
      }
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) setDenyMessage(null);
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl text-destructive">
            Hủy đơn hàng
          </DialogTitle>
          <DialogDescription>
            Bạn có chắc chắn muốn hủy đơn hàng{" "}
            <span className="font-semibold text-black">{order.orderCode}</span>{" "}
            không? Hành động này không thể hoàn tác.
          </DialogDescription>
        </DialogHeader>

        {denyMessage && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
            {denyMessage}
          </p>
        )}

        <DialogFooter className="flex justify-end gap-3 mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Huỷ
          </Button>

          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={isPending}
          >
            {isPending && <Loader className="size-4 animate-spin" />}
            Xác nhận
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
