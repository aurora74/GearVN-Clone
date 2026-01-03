"use client";

import { useMemo } from "react";

import { useQueryState } from "nuqs";

import { useBlogs } from "@/react-query/query/blog";

import { columns } from "./columns";
import { DataTable } from "./data-table";

export const BlogsPage = () => {
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

  const { data: blogs, isPending } = useBlogs(queryParams);

  const tableData = blogs?.data ?? [];
  const totalItems = blogs?.total ?? 0;
  const pageCount = blogs?.totalPages ?? 0;

  return (
    <div className="h-full p-4 space-y-4 border bg-white shadow-sm rounded-md">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold">Danh sách bài viết</h1>
        <p className="text-sm text-muted-foreground">({totalItems} bài viết)</p>
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
