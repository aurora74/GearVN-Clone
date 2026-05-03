"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useQueryState } from "nuqs";
import { SearchIcon, X } from "lucide-react";

import { useDebounce } from "@/hooks/use-debounce";

import { BlogType } from "@/types/blog";
import { type BlogSort } from "@/utils/api/blogs";
import { PaginatedResponse } from "@/types/global";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { BlogGrid } from "./blog-grid";
import { NoResults } from "./no-results";
import { BlogPagination } from "./blog-pagination";

const BLOG_SORT_OPTIONS: Array<{ value: BlogSort; label: string }> = [
  { value: "newest", label: "Mới nhất" },
  { value: "oldest", label: "Cũ nhất" },
];

export const AllBlogs = ({ blogs }: { blogs: PaginatedResponse<BlogType> }) => {
  const isEmpty = blogs.data.length === 0;

  const router = useRouter();
  const searchParams = useSearchParams();

  const [page, setPage] = useQueryState("page", {
    parse: (v) => (v ? Number(v) : 1),
    serialize: String,
  });

  const [search, setSearch] = useQueryState("search", {
    parse: String,
    serialize: String,
  });

  const [sort, setSort] = useQueryState("sort", {
    parse: (value): BlogSort => (value === "oldest" ? "oldest" : "newest"),
    serialize: String,
  });

  const [inputValue, setInputValue] = useState(search ?? "");
  const debouncedSearch = useDebounce(inputValue, 400);
  const currentSort: BlogSort = sort === "oldest" ? "oldest" : "newest";
  const currentSearch = search ?? "";

  useEffect(() => {
    router.refresh();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [searchParams, router]);

  useEffect(() => {
    if (debouncedSearch === currentSearch) return;

    setPage(1);
    setSearch(debouncedSearch || null);
  }, [currentSearch, debouncedSearch, setPage, setSearch]);

  const clearSearch = () => {
    setInputValue("");
    setSearch(null);
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(inputValue || "");
    setPage(1);
  };

  const handleSortChange = (value: BlogSort) => {
    setSort(value);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-background">
      <section className="py-12 bg-gradient-to-br from-primary/10 via-background to-accent/5 text-center">
        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Tất cả bài viết
        </h1>
        <p className="text-muted-foreground mt-2">
          Những câu chuyện thú vị, kiến thức bổ ích và góc nhìn độc đáo đang chờ
          bạn khám phá
        </p>

        <div className="mx-auto mt-6 flex w-full max-w-4xl flex-col gap-3 px-4 text-left md:flex-row md:items-end md:justify-center">
          <form
            onSubmit={handleSearchSubmit}
            className="relative w-full md:max-w-2xl"
          >
            <Input
              value={inputValue}
              aria-label="Tìm kiếm bài viết"
              placeholder="Tìm kiếm bài viết..."
              onChange={(e) => setInputValue(e.target.value)}
              className="h-10 rounded-full border border-primary/50 bg-white pl-10 pr-8 text-base"
            />
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
            {inputValue && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Xoá tìm kiếm"
                className="absolute top-1/2 right-3 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-muted/50 text-muted-foreground hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            )}
          </form>

          <div className="w-full md:w-44">
            <label
              id="blog-sort-label"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Sắp xếp bài viết
            </label>
            <Select
              value={currentSort}
              onValueChange={(value) => handleSortChange(value as BlogSort)}
            >
              <SelectTrigger
                aria-labelledby="blog-sort-label"
                className="h-10 border-primary/50 bg-white"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BLOG_SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {inputValue && blogs.data.length > 0 && (
          <p className="text-sm text-muted-foreground mt-4">
            Kết quả tìm kiếm cho:{" "}
            <span className="font-semibold">{inputValue}</span>
          </p>
        )}
      </section>

      <section className="max-w-7xl py-8 px-4 mx-auto">
        {isEmpty ? (
          <NoResults />
        ) : (
          <>
            <BlogGrid blogs={blogs.data} />
            {blogs.totalPages > 1 && (
              <BlogPagination
                currentPage={page ?? 1}
                totalPages={blogs.totalPages}
                onPageChange={handlePageChange}
              />
            )}
          </>
        )}
      </section>
    </div>
  );
};
