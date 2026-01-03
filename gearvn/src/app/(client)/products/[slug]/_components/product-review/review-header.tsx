import { ProductType } from "@/types/product";

import { renderStars } from "../render-stars";

export const ReviewHeader = ({ product }: { product: ProductType }) => {
  const average = product.averageRating ?? 0;

  const ratingText = average.toFixed(1);
  const ratingsCount = product.ratingsCount ?? 0;

  return (
    <header className="space-y-3">
      <h2
        title={`Đánh giá & Nhận xét ${product.name}`}
        className="text-xl font-semibold"
      >
        Đánh giá & Nhận xét {product.name}
      </h2>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
        <p
          aria-label={`Đánh giá trung bình: ${ratingText}`}
          className="text-5xl font-semibold"
        >
          {ratingText}
        </p>
        <div aria-label={`Đánh giá sao: ${average} trên 5`}>
          {renderStars(average)}
        </div>
        <p
          aria-label={`Tổng số lượt đánh giá: ${ratingsCount}`}
          className="text-muted-foreground"
        >
          ({ratingsCount} đánh giá)
        </p>
      </div>
    </header>
  );
};
