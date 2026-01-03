import Link from "next/link";
import Image from "next/image";

import { Icon } from "@iconify/react";

import { EventType } from "@/types/event";
import { ProductType } from "@/types/product";

import { formatPrice } from "@/utils/format/format-price";
import { getIconForAttribute } from "@/utils/get/get-icon-for-attribute";

type ProductCardProps = {
  events: EventType[];
  product: ProductType;
};

export const ProductCard = ({ events, product }: ProductCardProps) => {
  const matchedEvent = events.find((event) => event.tag === product.event);

  return (
    <article className="group border bg-white rounded-sm hover:shadow-lg overflow-hidden">
      <Link
        href={`/products/${product.slug}`}
        title={`Xem chi tiết sản phẩm ${product.name}`}
      >
        <div className="relative w-full aspect-square">
          <Image
            fill
            alt={product.name}
            title={product.name}
            src={product.images?.[0]}
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-contain p-3"
          />
          {matchedEvent && (
            <Image
              fill
              aria-hidden="true"
              alt={matchedEvent.name}
              src={matchedEvent.frame}
              sizes="(max-width: 768px) 100vw, 33vw"
              className="absolute inset-0 object-cover pointer-events-none"
            />
          )}
        </div>

        <div className="p-3 space-y-2">
          <h3
            title={product.name}
            className="h-[45px] text-[15px] font-semibold line-clamp-2"
          >
            {product.name}
          </h3>

          <div className="h-[60px] px-2 -mx-2 overflow-y-auto overflow-x-hidden custom-scroll">
            <ul className="flex flex-wrap gap-2 text-xs font-semibold text-muted-foreground">
              {Object.entries(product.attributes).map(
                ([attrKey, attrValue]) => (
                  <li
                    key={attrKey}
                    title={`${attrKey}: ${attrValue}`}
                    className="flex items-center gap-1 p-1 bg-[#ececec] rounded-sm"
                  >
                    <Icon
                      focusable="false"
                      aria-hidden="true"
                      icon={getIconForAttribute(attrKey)}
                      className="flex-shrink-0"
                    />
                    {attrValue}
                  </li>
                )
              )}
            </ul>
          </div>

          <div>
            <div className="h-[50px]">
              {product.discountPercent ? (
                <>
                  <p className="text-sm font-medium text-muted-foreground line-through">
                    {formatPrice(product.price)}
                  </p>
                  <p className="text-lg font-semibold text-primary">
                    {formatPrice(product.discountPrice)}
                  </p>
                </>
              ) : (
                <p className="text-lg font-semibold text-primary">
                  {formatPrice(product.price)}
                </p>
              )}
            </div>

            <div className="w-full flex flex-row items-center justify-between gap-2 mt-1">
              {!!product.discountPercent && (
                <p
                  aria-label={`Giảm giá ${product.discountPercent}%`}
                  className="text-[11px] sm:text-[13px] text-primary px-2 border border-primary bg-primary/10 rounded-sm"
                >
                  -{product.discountPercent}%
                  <span className="sr-only">Giảm giá</span>
                </p>
              )}
              <p className="text-[11px] sm:text-[13px] font-semibold text-gray-600">
                Số lượng: <span className="text-primary">{product.stock}</span>
              </p>
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
};
