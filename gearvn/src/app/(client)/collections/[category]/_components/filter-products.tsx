"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useQueryState } from "nuqs";
import { Icon } from "@iconify/react";
import { Search, ChevronDown, X, FunnelX } from "lucide-react";

import { cn } from "@/utils/cn";
import { parseFilters, serializeFilters } from "@/utils/filters";

import { useDebounce } from "@/hooks/use-debounce";
import { ATTRIBUTE_ICONS } from "@/constants/products/attribute-icons";
import { useCategoryByName } from "@/react-query/query/category";

import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

import { FiltersSkeleton } from "./filters-skeleton";

export const FilterProducts = ({ category }: { category: string }) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { data: fields, isPending } = useCategoryByName(category);

  const [, setPage] = useQueryState("page", {
    parse: (v) => Number(v) || 1,
    serialize: String,
  });
  const [search, setSearch] = useQueryState("search", {
    parse: String,
    serialize: String,
  });
  const [rawFilters, setRawFilters] = useQueryState("attributes", {
    parse: String,
    serialize: String,
  });

  const [inputValue, setInputValue] = useState(search ?? "");
  const debouncedSearch = useDebounce(inputValue, 400);

  useEffect(() => {
    setPage(1);
    setSearch(debouncedSearch || null);
  }, [debouncedSearch, setPage, setSearch]);

  useEffect(() => {
    router.refresh();
  }, [searchParams, router]);

  const filtersParsed = useMemo(() => parseFilters(rawFilters), [rawFilters]);
  const hasFilters = Object.keys(filtersParsed).length > 0;

  const clearFilters = () => {
    setPage(1);
    setRawFilters(null);
  };

  const clearSearch = () => {
    setPage(1);
    setSearch(null);
    setInputValue("");
  };

  const toggleFilter = (field: string, value: string) => {
    const values = filtersParsed[field] || [];

    const updated = values.includes(value)
      ? values.filter((v) => v !== value)
      : [...values, value];

    const next = { ...filtersParsed, [field]: updated };
    if (!updated.length) delete next[field];

    setPage(1);
    setRawFilters(Object.keys(next).length ? serializeFilters(next) : null);
  };

  if (isPending) return <FiltersSkeleton />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="relative w-full">
          <Input
            value={inputValue}
            aria-label="Tìm kiếm sản phẩm"
            placeholder="Bạn cần tìm sản phẩm gì?"
            onChange={(e) => setInputValue(e.target.value)}
            className="h-10 pl-10 pr-10"
          />

          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4.5 text-muted-foreground" />

          {search && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Xóa tìm kiếm"
              className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center size-6 rounded-full text-muted-foreground hover:text-destructive focus:outline-none focus:ring-2 focus:ring-destructive"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {hasFilters && (
          <Button
            variant="destructive"
            onClick={clearFilters}
            aria-label="Xóa tất cả bộ lọc"
            className="h-10 px-4"
          >
            <FunnelX className="mr-2 h-4 w-4" />
            Xoá bộ lọc
          </Button>
        )}
      </div>

      <ScrollArea>
        <div className="flex items-center gap-3">
          {fields?.map((field) => {
            const selected = filtersParsed[field.name] || [];
            const active = selected.length > 0;

            return (
              <Popover key={field.name}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={isPending}
                    aria-expanded={active}
                    aria-haspopup="listbox"
                    className={cn(
                      "h-10 gap-2 rounded-sm",
                      active &&
                        "text-primary hover:text-primary border-primary bg-primary/10 hover:bg-primary/10"
                    )}
                  >
                    {ATTRIBUTE_ICONS[field.name] && (
                      <Icon
                        icon={ATTRIBUTE_ICONS[field.name]}
                        className={cn(
                          "w-4 h-4",
                          active ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                    )}
                    <span>
                      {field.label}
                      {active && ` (${selected.length})`}
                    </span>
                    <ChevronDown
                      className={cn(
                        "w-3.5 h-3.5",
                        active ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                  </Button>
                </PopoverTrigger>

                <PopoverContent
                  align="start"
                  sideOffset={4}
                  className="w-48 p-2"
                >
                  <ScrollArea className="max-h-96 pr-2 overflow-auto custom-scroll">
                    {field.options?.map((opt) => {
                      const val = String(opt);

                      return (
                        <label
                          key={val}
                          className="flex items-center gap-2 py-1 px-1.5 cursor-pointer"
                        >
                          <Checkbox
                            checked={selected.includes(val)}
                            onCheckedChange={() =>
                              toggleFilter(field.name, val)
                            }
                          />
                          <span className="text-sm">{val}</span>
                        </label>
                      );
                    })}
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
};
