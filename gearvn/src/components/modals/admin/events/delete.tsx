"use client";

import { useState } from "react";

import { Loader } from "lucide-react";

import { EventType } from "@/types/event";
import { useDeleteEvent } from "@/react-query/mutation/event";

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

type ModalDeleteEventProps = {
  event: EventType;
  children: React.ReactNode;
  setOpenDropdown?: (open: boolean) => void;
};

export const ModalDeleteEvent = ({
  event,
  children,
  setOpenDropdown,
}: ModalDeleteEventProps) => {
  const [open, setOpen] = useState(false);

  const { mutate, isPending } = useDeleteEvent(() => {
    setOpen(false);
    setOpenDropdown?.(false);
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        setOpen(open);
        if (!open) setOpenDropdown?.(false);
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl text-destructive">
            Xoá sự kiện
          </DialogTitle>
          <DialogDescription>
            Bạn có chắc chắn muốn xoá sự kiện{" "}
            <span className="font-semibold text-black">{event.name}</span>? Hành
            động này <span className="font-semibold">không thể hoàn tác</span>.
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
            onClick={() => mutate(event._id)}
          >
            {isPending && <Loader className="size-4 animate-spin" />}
            Xoá
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
