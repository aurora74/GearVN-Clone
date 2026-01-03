import { ColumnDef } from "@tanstack/react-table";

import { User } from "@/types/user";

import { cn } from "@/utils/cn";
import { getAccountStatusUI } from "@/utils/get/get-account-status-ui";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

import { ActionsCell } from "./actions-cell";
import { SortableHeader } from "../../../_components/sortable-header";

import { Hint } from "@/components/global/hint";

export const columns: ColumnDef<User>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        aria-label="Select all"
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        aria-label="Select row"
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
      />
    ),
    enableSorting: false,
    enableHiding: false,
    meta: { label: "Chọn" },
  },

  {
    id: "avatar",
    header: "Ảnh",
    cell: ({ row }) => {
      const fullName = row.original.fullName;
      const avatarUrl = row.original.avatarUrl;

      return (
        <Avatar className="size-8">
          <AvatarImage src={avatarUrl} alt={`${fullName} avatar`} />
          <AvatarFallback>
            {fullName ? fullName.charAt(0).toUpperCase() : "N/A"}
          </AvatarFallback>
        </Avatar>
      );
    },
    enableSorting: false,
    meta: { label: "Ảnh" },
  },

  {
    accessorKey: "fullName",
    header: () => <SortableHeader label="Họ tên" sortKey="fullName" />,
    cell: ({ row }) => {
      const email = row.original.email;
      const fullName = row.original.fullName;

      return (
        <div>
          <p className="font-semibold">{fullName || "Chưa cập nhật"}</p>
          <p className="text-xs text-muted-foreground">
            {email || "Chưa cập nhật"}
          </p>
        </div>
      );
    },
    meta: { label: "Họ tên" },
  },

  {
    accessorKey: "phone",
    header: "Số điện thoại",
    cell: ({ row }) => row.original.phone || "Chưa cập nhật",
    meta: { label: "Số điện thoại" },
  },

  {
    accessorKey: "address",
    header: "Địa chỉ",
    cell: ({ row }) => {
      const address = row.original.address;
      return address ? (
        <Hint label={address}>
          <div className="max-w-[200px] truncate">{address}</div>
        </Hint>
      ) : (
        <div className="max-w-[200px] truncate">Chưa cập nhật</div>
      );
    },
    meta: { label: "Địa chỉ" },
  },

  {
    accessorKey: "status",
    header: "Trạng thái",
    cell: ({ row }) => {
      const status = row.original.status;
      const { icon: Icon, label, className } = getAccountStatusUI(status);

      return (
        <Badge variant="outline" className="flex items-center gap-1 px-2">
          <Icon className={cn("size-4", className)} />
          {label}
        </Badge>
      );
    },
    meta: { label: "Trạng thái" },
  },

  {
    accessorKey: "createdAt",
    header: () => <SortableHeader label="Ngày tạo" sortKey="createdAt" />,
    cell: ({ row }) => {
      const date = new Date(row.original.createdAt);

      return date.toLocaleString("vi-VN", {
        dateStyle: "short",
        timeStyle: "short",
      });
    },
    meta: { label: "Ngày tạo" },
  },

  {
    accessorKey: "updatedAt",
    header: () => <SortableHeader label="Cập nhật lúc" sortKey="updatedAt" />,
    cell: ({ row }) => {
      const date = new Date(row.original.updatedAt);

      return date.toLocaleString("vi-VN", {
        dateStyle: "short",
        timeStyle: "short",
      });
    },
    meta: { label: "Cập nhật lúc" },
  },

  {
    id: "actions",
    cell: ({ row }) => <ActionsCell user={row.original} />,
  },
];
