"use client";

import { useState } from "react";

import { Loader } from "lucide-react";

import { useDeleteMessages } from "@/react-query/mutation/chat";

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

type ModalDeleteMessagesProps = {
  userIds: string[];
  onDeleted: () => void;
  children: React.ReactNode;
};

export const ModalDeleteMessages = ({
  userIds,
  children,
  onDeleted,
}: ModalDeleteMessagesProps) => {
  const [open, setOpen] = useState(false);

  const { mutate, isPending } = useDeleteMessages(() => {
    setOpen(false);
    onDeleted();
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl text-destructive">
            Xoá tất cả tin nhắn
          </DialogTitle>
          <DialogDescription>
            Bạn có chắc chắn muốn xoá tất cả tin nhắn của những người dùng đã
            chọn? Hành động này không thể hoàn tác.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex justify-end gap-3 mt-4">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => setOpen(false)}
          >
            Huỷ
          </Button>

          <Button
            variant="destructive"
            disabled={isPending}
            onClick={() => mutate(userIds)}
          >
            {isPending && <Loader className="size-4 animate-spin" />}
            Xoá
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
