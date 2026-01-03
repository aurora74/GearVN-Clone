"use client";

import Image from "next/image";

import { ColumnDef } from "@tanstack/react-table";

import { CategoryType } from "@/types/category";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

import { ActionsCell } from "./actions-cell";
import { CategoryDetailsCell } from "./category-details-cell";
import { SortableHeader } from "../../../_components/sortable-header";

export const columns: ColumnDef<CategoryType>[] = [
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
    accessorKey: "image",
    header: () => <SortableHeader label="Ảnh" sortKey="image" />,
    cell: ({ row }) => (
      <div className="relative size-14 p-1">
        <Image
          fill
          src={row.original.image}
          alt={row.original.label}
          className="object-contain"
        />
      </div>
    ),
    meta: { label: "Ảnh" },
  },

  {
    accessorKey: "label",
    header: () => <SortableHeader label="Nhãn hiển thị" sortKey="label" />,
    cell: ({ row }) => <CategoryDetailsCell category={row.original} />,
    meta: { label: "Nhãn hiển thị" },
  },

  {
    accessorKey: "name",
    header: () => <SortableHeader label="Tên danh mục" sortKey="name" />,
    cell: ({ row }) => (
      <Badge
        variant="secondary"
        className={row.original.name.length <= 3 ? "uppercase" : "capitalize"}
      >
        {row.original.name}
      </Badge>
    ),
    meta: { label: "Tên danh mục" },
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
    cell: ({ row }) => <ActionsCell category={row.original} />,
  },
];
