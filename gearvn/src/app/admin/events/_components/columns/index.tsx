import Image from "next/image";

import { ColumnDef } from "@tanstack/react-table";
import { Tag as TagIcon, Image as ImageIcon } from "lucide-react";

import { EventType } from "@/types/event";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

import { ActionsCell } from "./actions-cell";
import { SortableHeader } from "../../../_components/sortable-header";

export const columns: ColumnDef<EventType>[] = [
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
    accessorKey: "frame",
    header: () => <span>Khung</span>,
    cell: ({ row }) =>
      row.original.frame ? (
        <div className="relative w-16 h-16">
          <Image
            fill
            alt={row.original.name}
            src={row.original.frame}
            className="object-contain"
          />
        </div>
      ) : (
        <ImageIcon className="size-4 text-muted-foreground" />
      ),
    enableSorting: false,
    meta: { label: "Ảnh" },
  },

  {
    accessorKey: "name",
    header: () => <span>Tên sự kiện</span>,
    cell: ({ row }) => (
      <span className="font-semibold">{row.original.name}</span>
    ),
    enableSorting: false,
    meta: { label: "Tên sự kiện" },
  },

  {
    accessorKey: "tag",
    header: () => <span>Tag</span>,
    cell: ({ row }) =>
      row.original.tag ? (
        <Badge variant="secondary" className="text-xs px-2 py-0.5 uppercase">
          {row.original.tag}
        </Badge>
      ) : (
        <TagIcon className="size-4 text-muted-foreground" />
      ),
    enableSorting: false,
    meta: { label: "Tag" },
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
    cell: ({ row }) => <ActionsCell event={row.original} />,
  },
];
