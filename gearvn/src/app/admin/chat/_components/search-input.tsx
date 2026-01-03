"use client";

import { useEffect, useState } from "react";

import { useQueryState } from "nuqs";
import { Search } from "lucide-react";

import { useDebounce } from "@/hooks/use-debounce";

import { Input } from "@/components/ui/input";

export const SearchInput = () => {
  const [search, setSearch] = useQueryState("search", {
    shallow: false,
    history: "push",
  });

  const [inputValue, setInputValue] = useState(search ?? "");
  const debouncedSearch = useDebounce(inputValue, 400);

  useEffect(() => {
    if (debouncedSearch !== search) {
      setSearch(debouncedSearch || null);
    }
  }, [debouncedSearch, search, setSearch]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 size-5 transform -translate-y-1/2 text-gray-400" />
      <Input
        type="text"
        value={inputValue}
        placeholder="Tìm kiếm khách hàng"
        onChange={(e) => setInputValue(e.target.value)}
        className="text-sm pl-10 border-gray-300 focus:border-primary"
      />
    </div>
  );
};
