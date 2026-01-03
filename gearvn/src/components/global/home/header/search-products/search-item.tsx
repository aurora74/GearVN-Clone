import Link from "next/link";
import Image from "next/image";

import { formatPrice } from "@/utils/format/format-price";
import { ProductType } from "@/types/product";

export const SearchItem = ({ product }: { product: ProductType }) => (
  <Link
    key={product._id}
    href={`/products/${product.slug}`}
    className="flex items-center gap-2 p-2 hover:bg-gray-100"
  >
    <Image
      width={50}
      height={50}
      alt={product.name}
      src={product.images[0]}
      className="object-cover rounded-sm"
    />
    <div className="flex-1">
      <div className="text-sm font-medium line-clamp-1">{product.name}</div>
      <div className="text-sm mt-1">
        {product.discountPrice ? (
          <div className="flex items-center gap-2">
            <span className="text-primary font-semibold">
              {formatPrice(product.discountPrice)}
            </span>
            <span className="text-muted-foreground line-through">
              {formatPrice(product.price)}
            </span>
          </div>
        ) : (
          <span className="font-semibold">{formatPrice(product.price)}</span>
        )}
      </div>
    </div>
  </Link>
);
