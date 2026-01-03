import { useEffect } from "react";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Table } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";

export const Pagination = <TData,>({ table }: { table: Table<TData> }) => {
  const pageCount = table.getPageCount();
  const pageIndex = table.getState().pagination.pageIndex;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pageIndex]);

  return (
    <div className="flex items-center justify-between mt-auto">
      <div className="flex-1 hidden lg:flex text-sm text-muted-foreground">
        Đã chọn {table.getFilteredSelectedRowModel().rows.length} /{" "}
        {table.getFilteredRowModel().rows.length} dòng.
      </div>

      <div className="flex w-full lg:w-fit items-center gap-8">
        <div className="flex w-fit items-center justify-center text-sm font-medium">
          Trang {pageIndex + 1} / {pageCount}
        </div>

        <div className="flex items-center gap-2 ml-auto lg:ml-0">
          <Button
            variant="outline"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            className="hidden lg:flex size-8 p-0"
          >
            <span className="sr-only">Trang đầu tiên</span>
            <ChevronsLeft />
          </Button>

          <Button
            size="icon"
            variant="outline"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="size-8"
          >
            <span className="sr-only">Trang trước</span>
            <ChevronLeft />
          </Button>

          <Button
            size="icon"
            variant="outline"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="size-8"
          >
            <span className="sr-only">Trang sau</span>
            <ChevronRight />
          </Button>

          <Button
            size="icon"
            variant="outline"
            disabled={!table.getCanNextPage()}
            onClick={() => table.setPageIndex(pageCount - 1)}
            className="hidden lg:flex size-8"
          >
            <span className="sr-only">Trang cuối cùng</span>
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  );
};
