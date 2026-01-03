"use client";

import { useState } from "react";

import { Loader } from "lucide-react";

import { User } from "@/types/user";
import { useDeleteUser } from "@/react-query/mutation/user";

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

type ModalDeleteUserProps = {
  user: User;
  children: React.ReactNode;
  setOpenDropdown: (open: boolean) => void;
};

export const ModalDeleteUser = ({
  user,
  children,
  setOpenDropdown,
}: ModalDeleteUserProps) => {
  const [open, setOpen] = useState(false);

  const { mutate, isPending } = useDeleteUser(() => {
    setOpen(false);
    setOpenDropdown(false);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl text-destructive">
            Xoá người dùng
          </DialogTitle>
          <DialogDescription>
            Bạn có chắc chắn muốn xoá người dùng{" "}
            <span className="font-semibold text-black">{user.fullName}</span>{" "}
            không? Hành động này không thể hoàn tác.
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
            onClick={() => mutate(user._id)}
          >
            {isPending && <Loader className="size-4 animate-spin" />}
            Xoá
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
