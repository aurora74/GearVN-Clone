import Image from "next/image";

import { OrderItemWithProduct } from "@/types/order";

import { formatPrice } from "@/utils/format/format-price";

export const OrderItemRow = ({ item }: { item: OrderItemWithProduct }) => {
  const productName = item.productName || item.productId.name;
  const productImage =
    item.productImage ||
    item.productId.images?.[0] ||
    "/images/product-placeholder.png";
  const originalPrice =
    item.originalPrice ?? item.unitPrice ?? item.productId.price;
  const finalPrice = item.finalPrice;
  const lineTotal = item.lineTotal ?? finalPrice * item.quantity;
  const hasDiscount = originalPrice > finalPrice;

  return (
    <div
      key={item.productId._id}
      aria-label={`Sản phẩm: ${productName}`}
      className="grid grid-cols-[80px_1fr_auto] sm:grid-cols-[96px_1fr_auto] gap-3 sm:gap-4 items-start"
    >
      <Image
        width={96}
        height={96}
        src={productImage}
        alt={`Ảnh sản phẩm ${productName}`}
        title={`Xem chi tiết ${productName}`}
        className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded"
      />

      <div className="text-start space-y-1">
        <p className="font-semibold text-sm sm:text-base leading-snug line-clamp-2">
          {productName}
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
          {formatPrice(lineTotal)}
        </p>
        {hasDiscount && (
          <p className="line-through text-muted-foreground">
            {formatPrice(originalPrice)}
          </p>
        )}
      </div>
    </div>
  );
};
