"use client";

import { useMemo } from "react";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useQueryState } from "nuqs";

import { useEvents } from "@/react-query/query/event";
import { EventType } from "@/types/event";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableLoading } from "../../_components/table-loading";
import { TableNoResults } from "../../_components/table-no-results";
import { Pagination } from "../../_components/pagination";

import { flashSaleColumns } from "./columns/flash-sale-columns";

export const FlashSaleTab = () => {
  const [page, setPage] = useQueryState("flashSalePage", {
    shallow: false,
    history: "push",
    parse: (v) => (v ? Number(v) : 0),
    serialize: (v) => String(v),
  });

  const queryParams = useMemo(
    () => ({
      page: (page ?? 0) + 1,
      limit: 20,
      sortBy: "-createdAt",
    }),
    [page]
  );

  const { data: events, isPending } = useEvents(queryParams);
  const tableData = events?.data ?? [];
  const pageCount = events?.totalPages ?? 0;

  const table = useReactTable<EventType>({
    data: tableData,
    columns: flashSaleColumns,
    pageCount,
    manualPagination: true,
    getCoreRowModel: getCoreRowModel(),
    onPaginationChange: (updater) => {
      const nextState =
        typeof updater === "function"
          ? updater({ pageIndex: page ?? 0, pageSize: 20 })
          : updater;

      setPage(nextState.pageIndex);
    },
    state: { pagination: { pageIndex: page ?? 0, pageSize: 20 } },
  });

  return (
    <PromotionTable
      table={table}
      columns={flashSaleColumns}
      isPending={isPending}
    />
  );
};

type PromotionTableProps<TData, TValue> = {
  table: ReturnType<typeof useReactTable<TData>>;
  columns: ColumnDef<TData, TValue>[];
  isPending: boolean;
};

const PromotionTable = <TData, TValue>({
  table,
  columns,
  isPending,
}: PromotionTableProps<TData, TValue>) => (
  <div className="flex min-h-[460px] flex-col gap-3">
    <div className="flex-1 overflow-auto rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isPending ? (
            <TableLoading columns={columns} />
          ) : table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableNoResults columns={columns} />
          )}
        </TableBody>
      </Table>
    </div>
    <Pagination table={table} />
  </div>
);
