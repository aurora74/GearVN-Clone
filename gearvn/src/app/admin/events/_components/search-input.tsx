import { useEffect, useState } from "react";

import { useQueryState } from "nuqs";

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
    <Input
      value={inputValue}
      placeholder="Tìm kiếm sự kiện"
      onChange={(e) => setInputValue(e.target.value)}
      className="w-full sm:w-[400px] bg-white"
    />
  );
};
