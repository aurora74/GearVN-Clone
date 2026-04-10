"use client";

import { useMemo } from "react";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useQueryState } from "nuqs";

import { useVouchers } from "@/react-query/query/voucher";
import { VoucherType } from "@/types/voucher";
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

import { voucherColumns } from "./columns/voucher-columns";

export const VoucherTab = () => {
  const [page, setPage] = useQueryState("voucherPage", {
    shallow: false,
    history: "push",
    parse: (v) => (v ? Number(v) : 0),
    serialize: (v) => String(v),
  });

  const queryParams = useMemo(
    () => ({
      page: (page ?? 0) + 1,
      limit: 20,
    }),
    [page]
  );

  const { data: vouchers, isPending } = useVouchers(queryParams);
  const tableData = vouchers?.data ?? [];
  const pageCount = vouchers?.totalPages ?? 0;

  const table = useReactTable<VoucherType>({
    data: tableData,
    columns: voucherColumns,
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
              <TableLoading columns={voucherColumns} />
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableNoResults columns={voucherColumns} />
            )}
          </TableBody>
        </Table>
      </div>
      <Pagination table={table} />
    </div>
  );
};
