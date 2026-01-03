"use client";

import { useMemo } from "react";

import { useQueryState } from "nuqs";

import { useUsers } from "@/react-query/query/user";

import { columns } from "./columns";
import { DataTable } from "./data-table";

export const CustomersPage = () => {
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

  const { data: users, isPending } = useUsers(queryParams);

  const tableData = users?.data ?? [];
  const totalItems = users?.total ?? 0;
  const pageCount = users?.totalPages ?? 0;

  return (
    <div className="h-full p-4 space-y-4 border bg-white shadow-sm rounded-md">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold">Danh sách khách hàng</h1>
        <p className="text-sm text-muted-foreground">
          ({totalItems} khách hàng)
        </p>
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
