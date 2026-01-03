import { ColumnDef } from "@tanstack/react-table";

import { ProductType } from "@/types/product";
import { formatPrice } from "@/utils/format/format-price";

import { Checkbox } from "@/components/ui/checkbox";

import ActionsCell from "./actions-cell";
import { ProductImageCell } from "./product-image-cell";
import { ProductDetailsCell } from "./product-details-cell";
import { SortableHeader } from "../../../_components/sortable-header";

export const columns: ColumnDef<ProductType>[] = [
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
    accessorKey: "images",
    header: "Ảnh",
    cell: ({ row }) => <ProductImageCell product={row.original} />,
    enableSorting: false,
    enableHiding: false,
    meta: { label: "Ảnh" },
  },

  {
    accessorKey: "name",
    header: () => <SortableHeader label="Tên sản phẩm" sortKey="name" />,
    cell: ({ row }) => <ProductDetailsCell product={row.original} />,
    meta: { label: "Tên sản phẩm" },
  },

  {
    accessorKey: "discountPrice",
    header: () => (
      <SortableHeader label="Giá bán (₫)" sortKey="discountPrice" />
    ),
    cell: ({ row }) => (
      <div className="font-semibold">
        {formatPrice(row.original.discountPrice)}
      </div>
    ),
    meta: { label: "Giá bán (₫)" },
  },

  {
    accessorKey: "price",
    header: () => <SortableHeader label="Giá gốc (₫)" sortKey="price" />,
    cell: ({ row }) => formatPrice(row.original.price),
    meta: { label: "Giá gốc (₫)" },
  },

  {
    accessorKey: "stock",
    header: () => <SortableHeader label="Số lượng" sortKey="stock" />,
    cell: ({ row }) => (
      <div className="font-mono text-center">{row.original.stock ?? "-"}</div>
    ),
    meta: { label: "Số lượng" },
  },

  {
    accessorKey: "discountPercent",
    header: "Giảm giá (%)",
    cell: ({ row }) => row.original.discountPercent + "%",
    meta: { label: "Giảm giá (%)" },
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
    cell: ({ row }) => <ActionsCell product={row.original} />,
    meta: { label: "Hành động" },
  },
];
