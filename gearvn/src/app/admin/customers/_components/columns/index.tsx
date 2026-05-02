import { ColumnDef } from "@tanstack/react-table";

import { User, UserRole } from "@/types/user";

import { cn } from "@/utils/cn";
import { getAccountStatusUI } from "@/utils/get/get-account-status-ui";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

import { ActionsCell } from "./actions-cell";
import { SortableHeader } from "../../../_components/sortable-header";

const roleLabels: Record<UserRole, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  PRODUCT_MARKETING_STAFF: "Product & Marketing",
  SALES_OPERATIONS_STAFF: "Sales & Operations",
  CSR: "CSR",
  CUSTOMER: "Customer",
};

const roleClassNames: Record<UserRole, string> = {
  ADMIN: "bg-muted text-foreground border-muted-foreground/20",
  MANAGER: "bg-primary/10 text-primary border-primary/20",
  PRODUCT_MARKETING_STAFF: "bg-blue-50 text-blue-700 border-blue-200",
  SALES_OPERATIONS_STAFF: "bg-amber-50 text-amber-700 border-amber-200",
  CSR: "bg-green-50 text-green-700 border-green-200",
  CUSTOMER: "bg-muted text-muted-foreground border-muted-foreground/20",
};

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
    accessorKey: "fullName",
    header: () => <SortableHeader label="Họ tên" sortKey="fullName" />,
    cell: ({ row }) => {
      const fullName = row.original.fullName;
      return <p className="font-semibold">{fullName || "Chưa cập nhật"}</p>;
    },
    meta: { label: "Họ tên" },
  },

  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => row.original.email || "Chưa cập nhật",
    meta: { label: "Email" },
  },

  {
    accessorKey: "role",
    header: "Vai trò",
    cell: ({ row }) => {
      const role = row.original.role as UserRole | undefined;
      const roleLabel = role ? roleLabels[role] : undefined;
      const roleClassName = role ? roleClassNames[role] : undefined;

      if (!roleLabel) {
        return (
          <Badge
            variant="outline"
            className="whitespace-nowrap px-2 text-muted-foreground border-muted-foreground/20"
          >
            Chưa có vai trò
          </Badge>
        );
      }

      return (
        <Badge
          variant="outline"
          className={cn("whitespace-nowrap px-2", roleClassName)}
        >
          {roleLabel}
        </Badge>
      );
    },
    meta: { label: "Vai trò" },
  },

  {
    accessorKey: "status",
    header: "Trạng thái",
    cell: ({ row }) => {
      const status = row.original.status;
      const { icon: Icon, label, className } = getAccountStatusUI(status);

      return (
        <Badge variant="outline" className="flex items-center gap-1 px-2 whitespace-nowrap">
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
    id: "actions",
    header: "Thao tác",
    cell: ({ row }) => <ActionsCell user={row.original} />,
    meta: { label: "Thao tác" },
  },
];
