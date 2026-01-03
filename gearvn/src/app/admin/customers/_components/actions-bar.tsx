import { Plus, MoreHorizontal } from "lucide-react";
import type { Table as TableType, Column } from "@tanstack/react-table";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

import { ExportExcelButton } from "../../_components/export-excel-button";
import { ColumnsVisibilityDropdown } from "../../_components/columns-visibility-dropdown";

import { ModalAddUser } from "@/components/modals/admin/user/add";

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
        <ModalAddUser>
          <Button>
            <Plus /> Thêm người dùng
          </Button>
        </ModalAddUser>

        <ExportExcelButton
          data={data}
          fileName="users.xlsx"
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
          <PopoverContent align="end" className="w-72 p-3 space-y-3">
            <ModalAddUser>
              <Button className="w-full justify-center sm:justify-start">
                <Plus className="mr-2 size-4" /> Thêm người dùng
              </Button>
            </ModalAddUser>

            <ExportExcelButton
              data={data}
              fileName="users.xlsx"
              tableColumns={tableColumns}
            />

            <ColumnsVisibilityDropdown table={table} />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};
