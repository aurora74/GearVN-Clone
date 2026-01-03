"use client";

import { useMemo } from "react";

import { useQueryState } from "nuqs";

import { useProducts } from "@/react-query/query/product";

import { columns } from "./columns";
import { DataTable } from "./data-table";

export const ProductsPage = () => {
  const [page] = useQueryState("page", {
    parse: (v) => Number(v ?? 0),
    serialize: (v) => String(v),
  });
  const [search] = useQueryState("search");
  const [sortBy] = useQueryState("sortBy");
  const [category] = useQueryState("category");

  const [attributes] = useQueryState<Record<string, string[]>>("attributes", {
    parse: (v) => (v ? JSON.parse(decodeURIComponent(v)) : {}),
    serialize: (v) => encodeURIComponent(JSON.stringify(v)),
  });

  const queryParams = useMemo(
    () => ({
      page: (page ?? 0) + 1,
      limit: 20,
      sortBy: sortBy || "-createdAt",
      category: category || undefined,
      attributes:
        attributes && Object.keys(attributes).length > 0
          ? attributes
          : undefined,
      search: search || undefined,
    }),
    [page, sortBy, category, attributes, search]
  );

  const { data: products, isPending } = useProducts(queryParams);

  const tableData = products?.data ?? [];
  const totalItems = products?.total ?? 0;
  const pageCount = products?.totalPages ?? 0;

  return (
    <div className="w-full h-full p-4 space-y-4 border bg-white rounded-md shadow-sm">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold">Danh sách sản phẩm</h1>
        <p className="text-sm text-muted-foreground">({totalItems} sản phẩm)</p>
      </div>
      <DataTable
        data={tableData}
        columns={columns}
        isPending={isPending}
        pageCount={pageCount}
      />
    </div>
  );
};
