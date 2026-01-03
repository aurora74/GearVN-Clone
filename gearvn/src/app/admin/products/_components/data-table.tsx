import { useEffect, useMemo, useState } from "react";

import {
  ColumnDef,
  flexRender,
  useReactTable,
  getCoreRowModel,
} from "@tanstack/react-table";
import { useQueryState } from "nuqs";

import { useCategories, useCategoryByName } from "@/react-query/query/category";

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
  const { data: categories } = useCategories();

  const [page, setPage] = useQueryState("page", {
    shallow: false,
    history: "push",
    parse: (v) => (v ? Number(v) : 0),
    serialize: (v) => String(v),
  });

  const [categoryParam, setCategoryParam] = useQueryState("category", {
    history: "push",
  });

  const [filtersParam, setFiltersParam] = useQueryState<string | null>(
    "attributes",
    {
      history: "push",
      parse: (v) => v ?? null,
      serialize: (v) => v ?? "",
    }
  );

  const [filters, setFilters] = useState<Record<string, string[]>>(() => {
    if (!filtersParam) return {};
    try {
      const obj: Record<string, string[]> = {};
      filtersParam.split(";").forEach((entry) => {
        const [key, vals] = entry.split("=");
        if (key && vals) obj[key] = vals.split(",");
      });
      return obj;
    } catch {
      return {};
    }
  });

  const [selectedCategory, setSelectedCategory] = useState(categoryParam || "");
  const { data: category, isPending: isPendingFields } = useCategoryByName(
    selectedCategory || ""
  );

  useEffect(() => {
    setCategoryParam(selectedCategory || null);
  }, [selectedCategory, setCategoryParam]);

  useEffect(() => {
    if (!filters || Object.keys(filters).length === 0) {
      setFiltersParam(null);
    } else {
      const param = Object.entries(filters)
        .map(([key, vals]) => `${key}=${vals.join(",")}`)
        .join(";");
      setFiltersParam(param);
    }
  }, [filters, setFiltersParam]);

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
      <div className="flex flex-row items-center justify-between gap-3">
        <SearchInput />

        <ActionsBar
          data={data}
          table={table}
          filters={filters}
          fields={category}
          setFilters={setFilters}
          categories={categories}
          tableColumns={tableColumns}
          isPendingFields={isPendingFields}
          setFiltersParam={setFiltersParam}
          selectedCategory={selectedCategory}
          setCategoryParam={setCategoryParam}
          setSelectedCategory={setSelectedCategory}
        />
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
