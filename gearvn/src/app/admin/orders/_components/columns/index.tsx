import { ColumnDef } from "@tanstack/react-table";

import { Order } from "@/types/order";
import { PAYMENT_METHOD } from "@/config.global";

import { cn } from "@/utils/cn";
import { formatPrice } from "@/utils/format/format-price";
import { getOrderStatusUI } from "@/utils/get/get-order-status-ui";
import { getPaymentStatusUI } from "@/utils/get/get-payment-status-ui";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

import { ActionsCell } from "./actions-cell";
import { OrderDetailsCell } from "./order-details-cell";
import { SortableHeader } from "../../../_components/sortable-header";

export const columns: ColumnDef<Order>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
      />
    ),
    enableSorting: false,
    enableHiding: false,
    meta: { label: "Chọn" },
  },

  {
    accessorKey: "orderCode",
    header: () => <SortableHeader label="Mã đơn" sortKey="orderCode" />,
    cell: ({ row }) => <OrderDetailsCell order={row.original} />,
    meta: { label: "Mã đơn" },
  },

  {
    accessorKey: "fullName",
    header: "Khách hàng",
    cell: ({ row }) => row.original.fullName,
    meta: { label: "Khách hàng" },
  },

  {
    accessorKey: "totalAmount",
    header: () => <SortableHeader label="Tổng tiền" sortKey="totalAmount" />,
    cell: ({ row }) => formatPrice(row.original.totalAmount),
    meta: { label: "Tổng tiền" },
  },

  {
    accessorKey: "orderStatus",
    header: "Trạng thái đơn",
    cell: ({ row }) => {
      const {
        label,
        className,
        icon: Icon,
      } = getOrderStatusUI(row.original.orderStatus);

      return (
        <Badge variant="outline" className="flex items-center gap-1 px-2">
          <Icon className={cn("size-4", className)} />
          {label}
        </Badge>
      );
    },
    meta: { label: "Trạng thái đơn" },
  },

  {
    accessorKey: "paymentStatus",
    header: "Thanh toán",
    cell: ({ row }) => {
      const {
        label,
        className,
        icon: Icon,
      } = getPaymentStatusUI(row.original.paymentStatus);

      return (
        <Badge variant="outline" className="flex items-center gap-1 px-2">
          <Icon className={cn("size-4", className)} />
          {label}
        </Badge>
      );
    },
    meta: { label: "Thanh toán" },
  },

  {
    accessorKey: "paymentMethod",
    header: "Phương thức",
    cell: ({ row }) =>
      row.original.paymentMethod === PAYMENT_METHOD.COD
        ? PAYMENT_METHOD.COD
        : PAYMENT_METHOD.VNPAY,
    meta: { label: "Phương thức" },
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
    cell: ({ row }) => <ActionsCell order={row.original} />,
  },
];
