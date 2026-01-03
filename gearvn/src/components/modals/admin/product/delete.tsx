"use client";

import { useState } from "react";
import { Loader } from "lucide-react";

import { ProductType } from "@/types/product";
import { useDeleteProduct } from "@/react-query/mutation/product";

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

type ModalDeleteProductProps = {
  product: ProductType;
  children: React.ReactNode;
  setOpenDropdown?: (open: boolean) => void;
};

export const ModalDeleteProduct = ({
  product,
  children,
  setOpenDropdown,
}: ModalDeleteProductProps) => {
  const [open, setOpen] = useState(false);

  const { mutate, isPending } = useDeleteProduct(() => {
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
            Xoá sản phẩm
          </DialogTitle>
          <DialogDescription>
            Bạn có chắc chắn muốn xoá sản phẩm{" "}
            <span className="font-semibold text-black">{product.name}</span>?
            Hành động này không thể hoàn tác.
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
            onClick={() => mutate(product._id)}
          >
            {isPending && <Loader className="size-4 animate-spin" />}
            Xoá
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
