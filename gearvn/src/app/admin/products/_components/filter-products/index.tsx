import {
  useMemo,
  useState,
  Dispatch,
  useCallback,
  SetStateAction,
} from "react";

import { Funnel, FunnelX, Loader } from "lucide-react";

import { cn } from "@/utils/cn";

import { PaginatedResponse } from "@/types/global";
import { CategoryType, CategoryFields } from "@/types/category";

import {
  Select,
  SelectItem,
  SelectValue,
  SelectContent,
  SelectTrigger,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

import { FilterOption } from "./filter-option";

type FilterProductsProps = {
  selectedCategory: string;
  fields?: CategoryFields[];
  isPendingFields?: boolean;
  filters: Record<string, string[]>;
  categories?: PaginatedResponse<CategoryType>;
  setSelectedCategory: (value: string) => void;
  setFiltersParam: (value: string | null) => void;
  setCategoryParam: (value: string | null) => void;
  setFilters: Dispatch<SetStateAction<Record<string, string[]>>>;
};

export const FilterProducts = ({
  fields,
  filters,
  categories,
  setFilters,
  isPendingFields,
  setFiltersParam,
  setCategoryParam,
  selectedCategory,
  setSelectedCategory,
}: FilterProductsProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const categoryOptions = useMemo(() => categories?.data || [], [categories]);

  const handleToggle = useCallback(
    (fieldName: string, value: string | number) => {
      setFilters((prev) => {
        const strValue = String(value);
        const currentValues = prev[fieldName] || [];
        const updatedValues = currentValues.includes(strValue)
          ? currentValues.filter((v) => v !== strValue)
          : [...currentValues, strValue];

        const newFilters = { ...prev };
        if (updatedValues.length > 0) {
          newFilters[fieldName] = updatedValues;
        } else {
          delete newFilters[fieldName];
        }

        setFiltersParam(
          Object.keys(newFilters).length > 0 ? JSON.stringify(newFilters) : null
        );

        return newFilters;
      });
    },
    [setFilters, setFiltersParam]
  );

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full sm:w-fit">
          <Funnel className="size-4" />
          Bộ lọc
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className={cn(
          "flex flex-col p-3 w-[90vw] max-w-sm sm:max-w-2xl md:max-w-4xl",
          selectedCategory ? "md:w-[900px]" : "w-80"
        )}
      >
        <div className="mb-2">
          <Label className="mb-2">Danh mục sản phẩm</Label>
          <Select
            value={selectedCategory || ""}
            onValueChange={(value) => {
              setSelectedCategory(value);
              setCategoryParam(value || null);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Chọn danh mục" />
            </SelectTrigger>
            <SelectContent>
              {categoryOptions.map((cat) => (
                <SelectItem key={cat._id} value={cat.name}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!selectedCategory && (
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            className="ml-auto"
          >
            Đóng
          </Button>
        )}

        {selectedCategory &&
          (isPendingFields ? (
            <div className="w-full flex flex-col items-center justify-center gap-2 py-6">
              <Loader className="size-6 text-primary animate-spin" />
              <p className="text-sm">Đang tải...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {fields && fields.length > 0 ? (
                fields.map((field) => (
                  <div key={field.name} className="mb-2">
                    <DropdownMenuLabel className="px-0">
                      {field.label}
                    </DropdownMenuLabel>

                    <div className="grid grid-cols-2 gap-1 max-h-48 overflow-auto custom-scroll">
                      {field.options?.map((option) => (
                        <FilterOption
                          key={option}
                          fieldName={field.name}
                          option={String(option)}
                          onToggle={handleToggle}
                          checked={
                            filters[field.name]?.includes(String(option)) ||
                            false
                          }
                        />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Không có bộ lọc nào
                </p>
              )}
            </div>
          ))}

        {(selectedCategory || Object.keys(filters).length > 0) && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="w-full sm:w-auto"
            >
              Đóng
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                setFilters({});
                setFiltersParam(null);
                setCategoryParam(null);
                setSelectedCategory("");
              }}
              className="w-full sm:w-auto"
            >
              <FunnelX className="size-4" />
              Xóa tất cả bộ lọc
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
