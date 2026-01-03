"use client";

import { useMemo } from "react";

import { useQueryState } from "nuqs";

import { useEvents } from "@/react-query/query/event";

import { columns } from "./columns";
import { DataTable } from "./data-table";

export const EventsPage = () => {
  const [page] = useQueryState("page", {
    parse: (v) => (v ? Number(v) : 0),
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

  const { data: events, isPending } = useEvents(queryParams);

  const tableData = events?.data ?? [];
  const totalItems = events?.total ?? 0;
  const pageCount = events?.totalPages ?? 0;

  return (
    <div className="h-full p-4 space-y-4 border bg-white shadow-sm rounded-md">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold">Danh sách sự kiện</h1>
        <p className="text-sm text-muted-foreground">({totalItems} sự kiện)</p>
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
