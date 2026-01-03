import { Search } from "lucide-react";

export const SearchEmpty = ({ keyword }: { keyword: string }) => (
  <div className="flex flex-col items-center justify-center text-sm text-gray-500 p-4">
    <Search className="size-6 mb-2 text-gray-400" />
    Không tìm thấy sản phẩm cho &quot;{keyword}&quot;
    <span className="text-xs mt-1 text-gray-400">Thử một từ khóa khác?</span>
  </div>
);
