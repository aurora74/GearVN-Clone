"use client";

import { useState } from "react";

import { Loader } from "lucide-react";

import { CategoryType } from "@/types/category";
import { useDeleteCategory } from "@/react-query/mutation/category";

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

type ModalDeleteCategoryProps = {
  category: CategoryType;
  children: React.ReactNode;
  setOpenDropdown?: (open: boolean) => void;
};

export const ModalDeleteCategory = ({
  category,
  children,
  setOpenDropdown,
}: ModalDeleteCategoryProps) => {
  const [open, setOpen] = useState(false);

  const { mutate, isPending } = useDeleteCategory(() => {
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
            Xoá danh mục
          </DialogTitle>
          <DialogDescription>
            Bạn có chắc chắn muốn xoá danh mục{" "}
            <span className="font-semibold text-black">{category.label}</span>?{" "}
            Hành động này{" "}
            <span className="font-semibold">không thể hoàn tác</span>.
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
            onClick={() => mutate(category._id)}
          >
            {isPending && <Loader className="size-4 animate-spin" />}
            Xoá
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
