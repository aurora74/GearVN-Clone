import { SearchIcon } from "lucide-react";

export const NoResults = () => (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <div className="flex items-center justify-center size-24 mb-6 bg-muted rounded-full">
      <SearchIcon className="size-10 text-muted-foreground" />
    </div>
    <h3 className="text-xl font-semibold mb-2">Không tìm thấy bài viết</h3>
    <p className="text-muted-foreground mb-6 max-w-lg">
      Thử tìm kiếm với từ khóa khác hoặc quay lại xem tất cả bài viết.
    </p>
  </div>
);
