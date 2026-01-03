import Link from "next/link";

import { Plus, MoreHorizontal } from "lucide-react";
import type { Table as TableType, Column } from "@tanstack/react-table";

import type { PaginatedResponse } from "@/types/global";
import type { CategoryFields, CategoryType } from "@/types/category";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

import { FilterProducts } from "./filter-products";
import { ExportExcelButton } from "../../_components/export-excel-button";
import { ColumnsVisibilityDropdown } from "../../_components/columns-visibility-dropdown";

type ActionsBarProps<TData> = {
  data: TData[];
  table: TableType<TData>;
  isPendingFields: boolean;
  selectedCategory: string;
  fields?: CategoryFields[];
  filters: Record<string, string[]>;
  tableColumns: Column<TData, unknown>[];
  categories?: PaginatedResponse<CategoryType>;
  setFiltersParam: (val: string | null) => void;
  setCategoryParam: (val: string | null) => void;
  setSelectedCategory: React.Dispatch<React.SetStateAction<string>>;
  setFilters: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
};

export const ActionsBar = <TData,>({
  data,
  table,
  fields,
  filters,
  setFilters,
  categories,
  tableColumns,
  isPendingFields,
  setFiltersParam,
  selectedCategory,
  setCategoryParam,
  setSelectedCategory,
}: ActionsBarProps<TData>) => {
  return (
    <div className="w-fit flex items-center justify-between sm:justify-end gap-2">
      <div className="hidden sm:flex gap-2">
        <Button asChild>
          <Link href="/admin/products/create">
            <Plus /> Thêm sản phẩm
          </Link>
        </Button>

        <FilterProducts
          filters={filters}
          fields={fields}
          setFilters={setFilters}
          categories={categories}
          isPendingFields={isPendingFields}
          setFiltersParam={setFiltersParam}
          selectedCategory={selectedCategory}
          setCategoryParam={setCategoryParam}
          setSelectedCategory={setSelectedCategory}
        />

        <ExportExcelButton
          data={data}
          fileName="products.xlsx"
          tableColumns={tableColumns}
        />

        <ColumnsVisibilityDropdown table={table} />
      </div>

      <div className="flex sm:hidden">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </PopoverTrigger>

          <PopoverContent align="end" className="w-72 p-3 space-y-3">
            <Button asChild className="w-full justify-center sm:justify-start">
              <Link href="/admin/products/create">
                <Plus className="mr-2 h-4 w-4" /> Thêm sản phẩm
              </Link>
            </Button>

            <FilterProducts
              filters={filters}
              fields={fields}
              setFilters={setFilters}
              categories={categories}
              isPendingFields={isPendingFields}
              setFiltersParam={setFiltersParam}
              selectedCategory={selectedCategory}
              setCategoryParam={setCategoryParam}
              setSelectedCategory={setSelectedCategory}
            />

            <ExportExcelButton
              data={data}
              fileName="products.xlsx"
              tableColumns={tableColumns}
            />

            <ColumnsVisibilityDropdown table={table} />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};
