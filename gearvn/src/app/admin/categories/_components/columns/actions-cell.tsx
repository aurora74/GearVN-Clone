"use client";

import { useState } from "react";

import { MoreVertical, Clipboard, Edit, Trash } from "lucide-react";

import { CategoryType } from "@/types/category";

import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toastSuccess } from "@/components/ui/toaster";

import { ModalEditCategory } from "@/components/modals/admin/categories/edit";
import { ModalDeleteCategory } from "@/components/modals/admin/categories/delete";

export const ActionsCell = ({ category }: { category: CategoryType }) => {
  const [openDropdown, setOpenDropdown] = useState(false);

  const handleCopyId = () => {
    navigator.clipboard.writeText(category._id);
    toastSuccess("Đã sao chép ID", "Mã danh mục đã được lưu vào clipboard.");
    setOpenDropdown(false);
  };

  return (
    <DropdownMenu open={openDropdown} onOpenChange={setOpenDropdown}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreVertical className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={handleCopyId}
          className="group hover:!bg-blue-500/10"
        >
          <Clipboard className="size-4 group-hover:text-blue-500" />
          <span className="group-hover:text-blue-500">Copy ID</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <ModalEditCategory
          category={category}
          setOpenDropdown={setOpenDropdown}
        >
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            className="group hover:!bg-green-500/10"
          >
            <Edit className="size-4 group-hover:text-green-500" />
            <span className="group-hover:text-green-500">Sửa</span>
          </DropdownMenuItem>
        </ModalEditCategory>

        <ModalDeleteCategory
          category={category}
          setOpenDropdown={setOpenDropdown}
        >
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            className="group hover:!bg-red-500/10"
          >
            <Trash className="size-4 group-hover:text-red-500" />
            <span className="group-hover:text-red-500">Xóa</span>
          </DropdownMenuItem>
        </ModalDeleteCategory>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
