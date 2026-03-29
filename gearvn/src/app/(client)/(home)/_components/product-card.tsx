"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { Icon } from "@iconify/react";
import { BadgePercent, Timer } from "lucide-react";

import { EventType } from "@/types/event";
import { ProductType } from "@/types/product";

import { formatPrice } from "@/utils/format/format-price";
import { calculateFinalPrice } from "@/utils/calculate/calculate-final-price";
import { getIconForAttribute } from "@/utils/get/get-icon-for-attribute";

type ProductCardProps = {
  events: EventType[];
  product: ProductType;
};

const HIDDEN_PROMOTION_STATUSES = new Set([
  "unpublished",
  "inactive",
  "unavailable",
  "archived",
  "hidden",
  "deleted",
  "disabled",
]);

const isProductVisibleForPromotion = (product: ProductType) => {
  const status = product.status?.trim().toLowerCase();

  return (
    product.stock > 0 &&
    product.promotionEligible !== false &&
    product.isPublished !== false &&
    product.published !== false &&
    product.isActive !== false &&
    product.available !== false &&
    product.isAvailable !== false &&
    (!status || !HIDDEN_PROMOTION_STATUSES.has(status))
  );
};

const getCountdownLabel = (endsAt: string | undefined, now: number) => {
  if (!endsAt) return "";

  const remaining = new Date(endsAt).getTime() - now;
  if (!Number.isFinite(remaining) || remaining <= 0) return "Vừa kết thúc";

  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days} ngày ${hours} giờ`;

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

export const ProductCard = ({ events, product }: ProductCardProps) => {
  const [now, setNow] = useState(() => Date.now());
  const matchedEvent = events.find((event) => event.tag === product.event);
  const activeFlashSale =
    matchedEvent?.status === "active" && isProductVisibleForPromotion(product);
  const activeSalePrice = activeFlashSale
    ? product.discountPrice ??
      calculateFinalPrice(product.price, product.discountPercent)
    : product.price;
  const countdownLabel = useMemo(
    () => getCountdownLabel(activeFlashSale ? matchedEvent?.endsAt : undefined, now),
    [activeFlashSale, matchedEvent?.endsAt, now]
  );

  useEffect(() => {
    if (!activeFlashSale || !matchedEvent?.endsAt) return;

    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [activeFlashSale, matchedEvent?.endsAt]);

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
          {activeFlashSale && matchedEvent?.frame && (
            <Image
              fill
              aria-hidden="true"
              alt={matchedEvent.name}
              src={matchedEvent.frame}
              sizes="(max-width: 768px) 100vw, 33vw"
              className="absolute inset-0 object-cover pointer-events-none"
            />
          )}
          {activeFlashSale && (
            <div className="absolute left-2 top-2 flex max-w-[calc(100%-16px)] flex-wrap gap-1">
              <span className="inline-flex items-center gap-1 rounded-sm bg-primary px-2 py-1 text-[11px] font-semibold text-white">
                <BadgePercent className="size-3" aria-hidden="true" />
                {matchedEvent?.name || "Flash sale"}
              </span>
            </div>
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
            <div className="h-[58px]">
              {activeFlashSale ? (
                <>
                  <p className="text-sm font-medium text-muted-foreground line-through">
                    {formatPrice(product.price)}
                  </p>
                  <p className="text-lg font-semibold text-primary">
                    {formatPrice(activeSalePrice)}
                  </p>
                </>
              ) : (
                <p className="text-lg font-semibold text-primary">
                  {formatPrice(product.price)}
                </p>
              )}
            </div>

            <div className="flex min-h-6 w-full flex-row items-center justify-between gap-2 mt-1">
              {activeFlashSale && !!product.discountPercent ? (
                <p
                  aria-label={`Giảm giá ${product.discountPercent}%`}
                  className="text-[11px] sm:text-[13px] text-primary px-2 border border-primary bg-primary/10 rounded-sm"
                >
                  -{product.discountPercent}%
                  <span className="sr-only">Giảm giá</span>
                </p>
              ) : (
                <span aria-hidden="true" />
              )}
              <p className="text-[11px] sm:text-[13px] font-semibold text-gray-600">
                Số lượng: <span className="text-primary">{product.stock}</span>
              </p>
            </div>

            {activeFlashSale && countdownLabel && (
              <p className="mt-2 flex min-h-5 items-center gap-1 text-[11px] font-semibold text-gray-600 sm:text-[13px]">
                <Timer className="size-3 text-primary" aria-hidden="true" />
                <span>{countdownLabel}</span>
              </p>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
};
