"use client";

import { useRouter } from "next/navigation";
import { LogOut, Package, LayoutDashboard, UserIcon } from "lucide-react";

import { User } from "@/types/user";
import { USER_ROLE } from "@/config.global";
import { useLogout } from "@/react-query/mutation/auth";

import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage } from "@/components/ui/avatar";

type Props = { user: User };

export const UserSettings = ({ user }: Props) => {
  const router = useRouter();

  const { mutate: logout } = useLogout();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Avatar className="size-9">
          <AvatarImage src={user?.avatarUrl || "/avatar-default.jpg"} />
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <div className="flex items-center gap-3 p-1.5">
          <Avatar className="size-9">
            <AvatarImage src={user?.avatarUrl || "/avatar-default.jpg"} />
          </Avatar>
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{user.fullName}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <DropdownMenuSeparator />

        {user.role === USER_ROLE.ADMIN && (
          <DropdownMenuItem
            onClick={() => router.push("/admin/dashboard")}
            className="group hover:!bg-blue-500/10"
          >
            <LayoutDashboard className="size-4 group-hover:text-blue-500" />
            <p className="group-hover:text-blue-500">Trang quản trị</p>
          </DropdownMenuItem>
        )}

        {user.role === USER_ROLE.CUSTOMER && (
          <>
            <DropdownMenuItem
              onClick={() => router.push("/settings/my-profile")}
              className="group"
            >
              <UserIcon className="size-4 group-hover:text-blue-500" />
              <p className="group-hover:text-blue-500">Xem hồ sơ</p>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => router.push("/settings/my-orders")}
              className="group"
            >
              <Package className="size-4 group-hover:text-blue-500" />
              <p className="group-hover:text-blue-500">Đơn hàng của tôi</p>
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuItem onClick={() => logout()} variant="destructive">
          <LogOut className="size-4" />
          <p>Đăng xuất</p>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
