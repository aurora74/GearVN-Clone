"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useQueryState } from "nuqs";
import { SearchIcon, X } from "lucide-react";

import { useDebounce } from "@/hooks/use-debounce";

import { BlogType } from "@/types/blog";
import { PaginatedResponse } from "@/types/global";

import { Input } from "@/components/ui/input";

import { BlogGrid } from "./blog-grid";
import { NoResults } from "./no-results";
import { BlogPagination } from "./blog-pagination";

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

  const [inputValue, setInputValue] = useState(search ?? "");
  const debouncedSearch = useDebounce(inputValue, 400);

  useEffect(() => {
    router.refresh();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [searchParams, router]);

  useEffect(() => {
    setPage(1);
    setSearch(debouncedSearch || null);
  }, [debouncedSearch, setPage, setSearch]);

  const clearSearch = () => {
    setSearch("");
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

        <form
          onSubmit={handleSearchSubmit}
          className="relative max-w-2xl mt-6 mx-auto"
        >
          <Input
            value={inputValue}
            aria-label="Tìm kiếm bài viết"
            placeholder="Tìm kiếm bài viết..."
            onChange={(e) => setInputValue(e.target.value)}
            className="pl-10 pr-8 h-10 text-base border border-primary/50 bg-white rounded-full"
          />
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
          {inputValue && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Xoá tìm kiếm"
              className="absolute top-1/2 right-3 -translate-y-1/2 size-6 flex items-center justify-center text-muted-foreground bg-muted/50 hover:bg-muted rounded-full cursor-pointer"
            >
              <X className="size-4" />
            </button>
          )}
        </form>

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
