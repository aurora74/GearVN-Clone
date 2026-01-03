"use client";

import { useMemo } from "react";
import { useQueryState } from "nuqs";

import { useCategories } from "@/react-query/query/category";
import { columns } from "./columns";
import { DataTable } from "./data-table";

export const CategoriesPage = () => {
  const [page] = useQueryState("page", {
    parse: (v) => Number(v ?? 0),
    serialize: (v) => String(v),
  });
  const [search] = useQueryState("search");
  const [sortBy] = useQueryState("sortBy");

  const queryParams = useMemo(
    () => ({
      page: (page ?? 0) + 1,
      limit: 20,
      sortBy: sortBy || "-createdAt",
      search: search || undefined,
    }),
    [page, sortBy, search]
  );

  const { data: categories, isPending } = useCategories(queryParams);

  const tableData = categories?.data ?? [];
  const totalItems = categories?.total ?? 0;
  const pageCount = categories?.totalPages ?? 0;

  return (
    <div className="w-full h-full p-4 space-y-4 border bg-white shadow-sm rounded-md">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold">Danh sách danh mục</h1>
        <p className="text-sm text-muted-foreground">({totalItems} danh mục)</p>
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
