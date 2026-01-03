import { useMemo } from "react";

import {
  ColumnDef,
  flexRender,
  useReactTable,
  getCoreRowModel,
} from "@tanstack/react-table";
import { useQueryState } from "nuqs";

import {
  Table,
  TableRow,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
} from "@/components/ui/table";

import { ActionsBar } from "./actions-bar";
import { SearchInput } from "./search-input";

import { Pagination } from "../../_components/pagination";
import { TableLoading } from "../../_components/table-loading";
import { TableNoResults } from "../../_components/table-no-results";

type DataTableProps<TData, TValue> = {
  data: TData[];
  pageCount: number;
  isPending: boolean;
  columns: ColumnDef<TData, TValue>[];
};

export const DataTable = <TData, TValue>({
  data,
  columns,
  isPending,
  pageCount,
}: DataTableProps<TData, TValue>) => {
  const [page, setPage] = useQueryState("page", {
    shallow: false,
    history: "push",
    parse: (v) => (v ? Number(v) : 0),
    serialize: (v) => String(v),
  });

  const table = useReactTable({
    data,
    columns,
    pageCount,
    manualPagination: true,
    getCoreRowModel: getCoreRowModel(),
    state: {
      pagination: { pageIndex: page ?? 0, pageSize: 20 },
    },
    onPaginationChange: (updater) => {
      const newState =
        typeof updater === "function"
          ? updater({ pageIndex: page ?? 0, pageSize: 20 })
          : updater;

      setPage(newState.pageIndex);
    },
  });

  const tableColumns = useMemo(
    () => table.getAllColumns().filter((col) => col.getIsVisible()),
    [table]
  );

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <SearchInput />
        <ActionsBar data={data} table={table} tableColumns={tableColumns} />
      </div>

      <div className="flex-1 border rounded-md">
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
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
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
              <TableNoResults columns={columns} />
            )}
          </TableBody>
        </Table>
      </div>

      <Pagination table={table} />
    </div>
  );
};
