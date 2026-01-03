"use client";

import Image from "next/image";

import { ColumnDef } from "@tanstack/react-table";

import { BlogType } from "@/types/blog";

import { ActionsCell } from "./actions-cell";
import { BlogDetailsCell } from "./blog-details-cell";
import { SortableHeader } from "@/app/admin/_components/sortable-header";

import { Hint } from "@/components/global/hint";

import { Checkbox } from "@/components/ui/checkbox";

export const columns: ColumnDef<BlogType>[] = [
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
    accessorKey: "thumbnail",
    header: () => <SortableHeader label="Ảnh" sortKey="thumbnail" />,
    cell: ({ row }) => {
      const url = row.original.thumbnail;

      return url ? (
        <div className="flex items-center justify-center">
          <div className="size-16 sm:size-24 relative rounded overflow-hidden">
            <Image src={url} alt="Thumbnail" fill className="object-contain" />
          </div>
        </div>
      ) : (
        <span className="text-muted-foreground italic">Không có</span>
      );
    },
    enableSorting: false,
    meta: { label: "Ảnh" },
    size: 120,
    minSize: 100,
  },

  {
    accessorKey: "title",
    header: () => <SortableHeader label="Tiêu đề" sortKey="title" />,
    cell: ({ row }) => <BlogDetailsCell blog={row.original} />,
    meta: { label: "Tiêu đề" },
  },

  {
    accessorKey: "slug",
    header: () => <SortableHeader label="Slug" sortKey="slug" />,
    cell: ({ row }) => (
      <Hint label={row.original.slug}>
        <div className="max-w-[200px] truncate">{row.original.slug}</div>
      </Hint>
    ),
    meta: { label: "Slug" },
  },

  {
    accessorKey: "summary",
    header: () => <SortableHeader label="Tóm tắt" sortKey="summary" />,
    cell: ({ row }) => (
      <div className="max-w-[200px] truncate">{row.original.summary}</div>
    ),
    meta: { label: "Tóm tắt" },
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
    cell: ({ row }) => <ActionsCell blog={row.original} />,
  },
];
