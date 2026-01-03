"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Clipboard, MoreVertical, Pencil, Trash2 } from "lucide-react";

import { BlogType } from "@/types/blog";

import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toastSuccess } from "@/components/ui/toaster";

import { ModalDeleteBlog } from "@/components/modals/admin/blogs/delete";

export const ActionsCell = ({ blog }: { blog: BlogType }) => {
  const router = useRouter();
  const [openDropdown, setOpenDropdown] = useState(false);

  const handleCopyId = () => {
    navigator.clipboard.writeText(blog._id);
    toastSuccess("Đã sao chép ID", "ID bài viết đã được lưu vào clipboard.");
    setOpenDropdown(false);
  };

  const handleEdit = () => {
    router.push(`/admin/blogs/${blog._id}`);
    setOpenDropdown(false);
  };

  return (
    <DropdownMenu open={openDropdown} onOpenChange={setOpenDropdown}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreVertical className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={handleCopyId}
          className="group hover:!bg-blue-500/10"
        >
          <Clipboard className="size-4 group-hover:text-blue-500" />
          <span className="group-hover:text-blue-500">Copy ID</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onSelect={handleEdit}
          className="group hover:!bg-blue-500/10"
        >
          <Pencil className="size-4 group-hover:text-blue-500" />
          <span className="group-hover:text-blue-500">Sửa</span>
        </DropdownMenuItem>

        <ModalDeleteBlog blog={blog} setOpenDropdown={setOpenDropdown}>
          <DropdownMenuItem
            variant="destructive"
            onSelect={(e) => e.preventDefault()}
            className="group"
          >
            <Trash2 className="size-4 group-hover:text-red-500" />
            <span className="group-hover:text-red-500">Xóa</span>
          </DropdownMenuItem>
        </ModalDeleteBlog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
