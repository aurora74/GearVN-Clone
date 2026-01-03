import { RefObject } from "react";

import { ArrowDown, Loader } from "lucide-react";

import { ProductType } from "@/types/product";

import { SearchItem } from "./search-item";
import { SearchEmpty } from "./search-empty";

import { Button } from "@/components/ui/button";

type Props = {
  keyword: string;
  isPending: boolean;
  totalResults: number;
  onLoadMore: () => void;
  products: ProductType[];
  dropdownRef: RefObject<HTMLDivElement | null>;
};

export const SearchDropdown = ({
  keyword,
  products,
  isPending,
  onLoadMore,
  dropdownRef,
  totalResults,
}: Props) => {
  if (!keyword) return null;

  return (
    <div
      ref={dropdownRef}
      className="max-h-96 absolute top-full left-0 w-full border bg-white rounded-sm mt-1 shadow-lg overflow-auto custom-scroll z-50"
    >
      {isPending ? (
        <div className="flex flex-col items-center justify-center gap-2 p-4">
          <Loader className="size-5 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Đang tìm kiếm...</p>
        </div>
      ) : products.length > 0 ? (
        <>
          <div className="px-3 py-2 text-sm text-gray-500 border-b">
            {totalResults} kết quả tìm kiếm cho &quot;{keyword}&quot;
          </div>

          {products.map((p) => (
            <SearchItem key={p._id} product={p} />
          ))}

          {totalResults > products.length && (
            <div className="flex justify-center mb-2">
              <Button
                size="sm"
                onClick={onLoadMore}
                className="text-gray-700 bg-gray-200 hover:bg-gray-300 flex items-center gap-1"
              >
                <ArrowDown className="size-4" /> Xem thêm
              </Button>
            </div>
          )}
        </>
      ) : (
        <SearchEmpty keyword={keyword} />
      )}
    </div>
  );
};
