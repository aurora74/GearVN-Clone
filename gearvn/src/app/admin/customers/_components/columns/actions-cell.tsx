import { useState } from "react";

import { MoreVertical, Clipboard, Pencil, Trash2, Ban } from "lucide-react";

import { User } from "@/types/user";
import { ACCOUNT_STATUS } from "@/config.global";

import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toastSuccess } from "@/components/ui/toaster";

import { ModalBanUser } from "@/components/modals/admin/user/ban";
import { ModalEditUser } from "@/components/modals/admin/user/edit";
import { ModalDeleteUser } from "@/components/modals/admin/user/delete";

export const ActionsCell = ({ user }: { user: User }) => {
  const [openDropdown, setOpenDropdown] = useState(false);

  const handleCopyId = () => {
    navigator.clipboard.writeText(user._id);
    toastSuccess("Đã sao chép ID", "Mã người dùng đã được lưu vào clipboard.");
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
        <DropdownMenuItem onClick={handleCopyId} className="group">
          <Clipboard className="size-4 group-hover:text-blue-500" />
          <p className="group-hover:text-blue-500">Copy ID</p>
        </DropdownMenuItem>

        <ModalEditUser user={user} setOpenDropdown={setOpenDropdown}>
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            className="group hover:!bg-blue-500/10"
          >
            <Pencil className="size-4 group-hover:text-blue-500" />
            <p className="group-hover:text-blue-500">Sửa</p>
          </DropdownMenuItem>
        </ModalEditUser>

        <DropdownMenuSeparator />

        {user.status !== ACCOUNT_STATUS.BANNED && (
          <ModalBanUser user={user} setOpenDropdown={setOpenDropdown}>
            <DropdownMenuItem
              variant="destructive"
              onSelect={(e) => e.preventDefault()}
              className="group hover:!bg-red-500/10"
            >
              <Ban className="size-4 group-hover:text-red-500" />
              <p className="group-hover:text-red-500">Khóa tài khoản</p>
            </DropdownMenuItem>
          </ModalBanUser>
        )}

        <ModalDeleteUser user={user} setOpenDropdown={setOpenDropdown}>
          <DropdownMenuItem
            variant="destructive"
            onSelect={(e) => e.preventDefault()}
            className="group"
          >
            <Trash2 className="size-4 group-hover:text-red-500" />
            <p className="group-hover:text-red-500">Xóa</p>
          </DropdownMenuItem>
        </ModalDeleteUser>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
