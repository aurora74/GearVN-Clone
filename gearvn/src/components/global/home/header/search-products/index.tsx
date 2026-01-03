"use client";

import { usePathname } from "next/navigation";
import { useState, useRef, useEffect, useLayoutEffect } from "react";

import { useQueryState } from "nuqs";
import { Search, X } from "lucide-react";

import { ProductType } from "@/types/product";
import { useDebounce } from "@/hooks/use-debounce";
import { useProducts } from "@/react-query/query/product";

import { Input } from "@/components/ui/input";

import { SearchDropdown } from "./search-dropdown";

export const SearchProducts = () => {
  const [search, setSearch] = useQueryState("search", {
    shallow: true,
    history: "push",
  });

  const [inputValue, setInputValue] = useState(search ?? "");
  const debouncedSearch = useDebounce(inputValue, 400);

  const [page, setPage] = useState(1);
  const [allProducts, setAllProducts] = useState<ProductType[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const scrollTopRef = useRef(0);

  const { data: productsData, isPending } = useProducts({
    page,
    limit: 10,
    search: debouncedSearch || undefined,
  });

  const pathname = usePathname();

  useEffect(() => {
    setSearch(debouncedSearch || null);
    setPage(1);
    setShowDropdown(!!debouncedSearch);
  }, [debouncedSearch, setSearch]);

  useLayoutEffect(() => {
    if (!productsData?.data || !dropdownRef.current) return;
    setAllProducts((prev) =>
      page === 1 ? productsData.data : [...prev, ...productsData.data]
    );
    if (page > 1) dropdownRef.current.scrollTop = scrollTopRef.current;
  }, [productsData, page]);

  useEffect(() => {
    setPage(1);
    setSearch(null);
    setInputValue("");
    setAllProducts([]);
    setShowDropdown(false);
  }, [pathname, setSearch]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest("input")
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const clearSearch = () => {
    setPage(1);
    setSearch(null);
    setInputValue("");
    setAllProducts([]);
    setShowDropdown(false);
  };

  const loadMore = () => {
    if (!dropdownRef.current) return;
    scrollTopRef.current = dropdownRef.current.scrollTop;
    setPage((prev) => prev + 1);
  };

  return (
    <div className="relative w-full">
      <Input
        value={inputValue}
        aria-label="Tìm kiếm"
        placeholder="Bạn cần tìm gì?"
        onChange={(e) => {
          setInputValue(e.target.value);
          setShowDropdown(!!e.target.value);
        }}
        className="h-10 !text-[15px] placeholder:text-[15px] pr-10 bg-white focus-visible:ring-0 focus-visible:border-transparent rounded-sm"
      />

      {inputValue && (
        <button
          onClick={clearSearch}
          aria-label="Clear search"
          className="absolute top-1/2 right-8 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 cursor-pointer"
        >
          <X className="size-5" />
        </button>
      )}

      <Search className="hidden sm:block absolute top-1/2 right-3 -translate-y-1/2 size-5" />

      {showDropdown && (
        <SearchDropdown
          isPending={isPending}
          keyword={debouncedSearch}
          products={allProducts}
          totalResults={productsData?.total ?? 0}
          onLoadMore={loadMore}
          dropdownRef={dropdownRef}
        />
      )}
    </div>
  );
};
