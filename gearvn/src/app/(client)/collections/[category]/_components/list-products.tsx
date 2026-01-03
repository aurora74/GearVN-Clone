"use client";

import { useRouter } from "next/navigation";

import { EventType } from "@/types/event";
import { ProductType } from "@/types/product";
import { PaginatedResponse } from "@/types/global";

import {
  Pagination,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationContent,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";

import { ProductCard } from "../../../(home)/_components/product-card";

type ListProductsProps = {
  page: number;
  category: string;
  events: EventType[];
  products: PaginatedResponse<ProductType>;
};

export const ListProducts = ({
  events,
  page = 1,
  category,
  products,
}: ListProductsProps) => {
  const router = useRouter();

  const items = products.data;
  const totalPages = products.totalPages;

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages) return;
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set("page", p.toString());
    router.push(`/collections/${category}?${searchParams.toString()}`);
  };

  const paginationRange = (): (number | "ellipsis")[] => {
    const delta = 2;
    const range: (number | "ellipsis")[] = [];

    for (
      let i = Math.max(2, page - delta);
      i <= Math.min(totalPages - 1, page + delta);
      i++
    ) {
      range.push(i);
    }

    if (page - delta > 2) range.unshift("ellipsis");
    if (page + delta < totalPages - 1) range.push("ellipsis");

    return range;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {items.map((product) => (
          <ProductCard key={product._id} product={product} events={events} />
        ))}
      </div>

      {totalPages > 1 && (
        <Pagination className="justify-center">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={page > 1 ? () => goToPage(page - 1) : undefined}
                className={page <= 1 ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>

            <PaginationItem>
              <PaginationLink isActive={page === 1} onClick={() => goToPage(1)}>
                1
              </PaginationLink>
            </PaginationItem>

            {paginationRange().map((p, i) =>
              p === "ellipsis" ? (
                <PaginationItem key={`e-${i}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={p}>
                  <PaginationLink
                    isActive={page === p}
                    onClick={() => goToPage(p)}
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              )
            )}

            {totalPages > 1 && (
              <PaginationItem>
                <PaginationLink
                  isActive={page === totalPages}
                  onClick={() => goToPage(totalPages)}
                >
                  {totalPages}
                </PaginationLink>
              </PaginationItem>
            )}

            <PaginationItem>
              <PaginationNext
                onClick={
                  page < totalPages ? () => goToPage(page + 1) : undefined
                }
                className={
                  page >= totalPages ? "pointer-events-none opacity-50" : ""
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
};
