"use client";

import { useState } from "react";

import { Loader } from "lucide-react";

import { BlogType } from "@/types/blog";
import { useDeleteBlog } from "@/react-query/mutation/blog";

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

type ModalDeleteBlogProps = {
  blog: BlogType;
  children: React.ReactNode;
  setOpenDropdown?: (open: boolean) => void;
};

export const ModalDeleteBlog = ({
  blog,
  children,
  setOpenDropdown,
}: ModalDeleteBlogProps) => {
  const [open, setOpen] = useState(false);

  const { mutate, isPending } = useDeleteBlog(() => {
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
            Xoá bài viết
          </DialogTitle>
          <DialogDescription>
            Bạn có chắc chắn muốn xoá bài viết{" "}
            <span className="font-semibold text-black">{blog.title}</span>? Hành
            động này không thể hoàn tác.
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
            disabled={isPending}
            variant="destructive"
            onClick={() => mutate(blog._id)}
          >
            {isPending && <Loader className="size-4 animate-spin" />}
            Xoá
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
