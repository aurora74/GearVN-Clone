import Image from "next/image";

import { OrderItemWithProduct } from "@/types/order";

import { formatPrice } from "@/utils/format/format-price";
import { calculateDiscountedPrice } from "@/utils/calculate/calculate-discount-price";

export const OrderItemRow = ({ item }: { item: OrderItemWithProduct }) => {
  const { finalPrice, hasDiscount } = calculateDiscountedPrice(
    item.productId.price,
    item.productId.discountPercent
  );

  return (
    <div
      key={item.productId._id}
      aria-label={`Sản phẩm: ${item.productId.name}`}
      className="grid grid-cols-[80px_1fr_auto] sm:grid-cols-[96px_1fr_auto] gap-3 sm:gap-4 items-start"
    >
      <Image
        width={96}
        height={96}
        src={item.productId.images[0]}
        alt={`Ảnh sản phẩm ${item.productId.name}`}
        title={`Xem chi tiết ${item.productId.name}`}
        className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded"
      />

      <div className="text-start space-y-1">
        <p className="font-semibold text-sm sm:text-base leading-snug line-clamp-2">
          {item.productId.name}
        </p>
        <p className="text-sm">
          {item.quantity}{" "}
          <span className="text-primary font-semibold">
            × {formatPrice(finalPrice)}
          </span>
        </p>
      </div>

      <div className="text-right text-sm space-y-0.5 min-w-[80px]">
        <p className="text-primary font-semibold">
          {formatPrice(finalPrice * item.quantity)}
        </p>
        {hasDiscount && (
          <p className="line-through text-muted-foreground">
            {formatPrice(item.productId.price)}
          </p>
        )}
      </div>
    </div>
  );
};
