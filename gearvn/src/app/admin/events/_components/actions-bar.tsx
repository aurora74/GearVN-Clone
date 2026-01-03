import { Plus, MoreHorizontal } from "lucide-react";
import type { Column, Table as TableType } from "@tanstack/react-table";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

import { ModalAddEvent } from "@/components/modals/admin/events/add";

import { ExportExcelButton } from "../../_components/export-excel-button";
import { ColumnsVisibilityDropdown } from "../../_components/columns-visibility-dropdown";

type ActionsBarProps<TData> = {
  data: TData[];
  table: TableType<TData>;
  tableColumns: Column<TData, unknown>[];
};

export const ActionsBar = <TData,>({
  data,
  table,
  tableColumns,
}: ActionsBarProps<TData>) => {
  return (
    <div className="w-fit flex items-center justify-between sm:justify-end gap-2">
      <div className="hidden sm:flex gap-2">
        <ModalAddEvent>
          <Button className="flex items-center gap-2">
            <Plus /> Thêm sự kiện
          </Button>
        </ModalAddEvent>

        <ExportExcelButton
          data={data}
          fileName="events.xlsx"
          tableColumns={tableColumns}
        />

        <ColumnsVisibilityDropdown table={table} />
      </div>

      <div className="flex sm:hidden">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreHorizontal className="size-5" />
            </Button>
          </PopoverTrigger>

          <PopoverContent
            align="end"
            className="w-screen max-w-[90vw] max-h-[70vh] p-3 overflow-auto space-y-3"
          >
            <ModalAddEvent>
              <Button className="w-full flex items-center justify-center sm:justify-start gap-2">
                <Plus className="size-4" /> Thêm sự kiện
              </Button>
            </ModalAddEvent>

            <ExportExcelButton
              data={data}
              fileName="events.xlsx"
              tableColumns={tableColumns}
            />

            <ColumnsVisibilityDropdown table={table} />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};
