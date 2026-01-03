"use client";

import { useState } from "react";
import { Loader } from "lucide-react";

import { useDeleteComment } from "@/react-query/mutation/product";

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
  productId: string;
  commentId: string;
  children: React.ReactNode;
};

export const ModalDeleteComment = ({
  productId,
  commentId,
  children,
}: Props) => {
  const [open, setOpen] = useState(false);

  const { mutate, isPending } = useDeleteComment(() => {
    setOpen(false);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl text-destructive">
            Xoá bình luận
          </DialogTitle>
          <DialogDescription>
            Bạn có chắc chắn muốn xoá bình luận này? Hành động này không thể
            hoàn tác.
          </DialogDescription>
        </DialogHeader>

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
            onClick={() => mutate({ productId, commentId })}
            disabled={isPending}
          >
            {isPending && <Loader className="size-4 animate-spin" />}
            Xoá
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
