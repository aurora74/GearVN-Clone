"use client";

import Link from "next/link";
import { useState, useMemo, useEffect } from "react";
import { BadgePercent, Timer } from "lucide-react";

import { USER_ROLE } from "@/config.global";

import { formatPrice } from "@/utils/format/format-price";
import { calculateFinalPrice } from "@/utils/calculate/calculate-final-price";

import { EventType } from "@/types/event";
import { ProductType } from "@/types/product";

import { useRoleStore } from "@/stores/use-role-store";
import { useCartStore } from "@/stores/use-cart-store";
import { useAuthModal } from "@/stores/use-auth-modal";

import { renderStars } from "../render-stars";
import { QuantityInput } from "./quantity-input";
import { RelatedProducts } from "../related-products";

import { Button } from "@/components/ui/button";

type ProductInfoProps = {
  events: EventType[];
  product: ProductType;
  relatedProducts: ProductType[];
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

export const ProductInfo = ({
  events,
  product,
  relatedProducts,
}: ProductInfoProps) => {
  const [quantity, setQuantity] = useState(1);
  const [now, setNow] = useState(() => Date.now());

  const { role } = useRoleStore();
  const { setModal } = useAuthModal();
  const { addToCart } = useCartStore();

  const matchedEvent = events.find((event) => event.tag === product.event);
  const activeFlashSale =
    matchedEvent?.status === "active" && isProductVisibleForPromotion(product);
  const finalPrice = useMemo(
    () =>
      activeFlashSale
        ? product.discountPrice ??
          calculateFinalPrice(product.price, product.discountPercent)
        : product.price,
    [
      activeFlashSale,
      product.discountPercent,
      product.discountPrice,
      product.price,
    ],
  );
  const countdownLabel = useMemo(
    () => getCountdownLabel(activeFlashSale ? matchedEvent?.endsAt : undefined, now),
    [activeFlashSale, matchedEvent?.endsAt, now],
  );

  const normalizedStock = Number(product.stock);
  const hasStockLimit = Number.isFinite(normalizedStock) && normalizedStock >= 0;
  const maxQuantity = hasStockLimit ? Math.max(1, Math.floor(normalizedStock)) : undefined;
  const isOutOfStock = hasStockLimit ? normalizedStock <= 0 : false;

  useEffect(() => {
    if (typeof maxQuantity !== "number") {
      return;
    }

    setQuantity((current) => Math.min(current, maxQuantity));
  }, [maxQuantity]);

  useEffect(() => {
    if (!activeFlashSale || !matchedEvent?.endsAt) return;

    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [activeFlashSale, matchedEvent?.endsAt]);

  const increase = () => {
    if (typeof maxQuantity === "number") {
      setQuantity((current) => Math.min(maxQuantity, current + 1));
      return;
    }

    setQuantity((current) => current + 1);
  };

  const decrease = () => setQuantity((current) => Math.max(1, current - 1));

  const handleAddToCart = () => {
    if (!role) return setModal("login");
    if (isOutOfStock) return;

    const safeQuantity =
      typeof maxQuantity === "number" ? Math.min(quantity, maxQuantity) : quantity;
    const flashSaleHints = activeFlashSale
      ? {
          flashSaleEventName: matchedEvent?.name ?? "Flash sale",
          flashSaleEndsAt: matchedEvent?.endsAt,
          clientFinalPrice: finalPrice,
        }
      : {};

    addToCart({
      quantity: safeQuantity,
      finalPrice,
      id: product._id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      image: product.images?.[0],
      discountPercent: activeFlashSale ? product.discountPercent ?? 0 : 0,
      ...flashSaleHints,
    });
  };

  return (
    <div className="w-full lg:w-1/2 space-y-4">
      <h1 className="text-[22px] font-bold">{product.name}</h1>

      <p className="font-medium text-gray-600 mt-1">
        Số lượng: <span className="text-primary">{product.stock}</span>
      </p>

      {product.averageRating ? (
        <div className="flex items-center gap-2">
          {renderStars(product.averageRating)}
          <span className="text-sm font-medium text-gray-600">
            {product.averageRating.toFixed(1)} / 5.0
          </span>
          <Link
            href={"/"}
            title="Xem đánh giá sản phẩm"
            className="text-sm font-medium text-blue-500 hover:underline"
          >
            Xem đánh giá
          </Link>
        </div>
      ) : null}

      <div className="space-y-3 rounded-sm border border-primary/20 bg-primary/5 p-4">
        {activeFlashSale && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-sm bg-primary px-2 py-1 text-sm font-semibold text-white">
              <BadgePercent className="size-4" aria-hidden="true" />
              {matchedEvent?.name || "Flash sale"}
            </span>
            {countdownLabel && (
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-700">
                <Timer className="size-4 text-primary" aria-hidden="true" />
                {countdownLabel}
              </span>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
          <p className="text-3xl font-bold text-primary">
            {formatPrice(finalPrice)}
          </p>
          {activeFlashSale && (
            <div className="flex items-center gap-3">
              <p className="text-lg font-medium text-muted-foreground line-through">
                {formatPrice(product.price)}
              </p>
              {!!product.discountPercent && (
                <p className="text-[13px] text-primary py-0.5 px-2.5 border border-primary bg-primary/10 rounded-sm">
                  -{product.discountPercent}%
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <p className="text-sm font-medium">Số lượng:</p>
        <QuantityInput
          quantity={quantity}
          decrease={decrease}
          increase={increase}
          setQuantity={setQuantity}
          max={maxQuantity}
          disabled={isOutOfStock}
        />
      </div>

      <Button
        onClick={handleAddToCart}
        aria-label="Mua ngay sản phẩm"
        disabled={role === USER_ROLE.ADMIN || isOutOfStock}
        className="w-full h-[70px] flex flex-col gap-1"
      >
        <p className="text-lg font-bold uppercase">Mua ngay</p>
        <p className="text-sm">Giao tận nơi hoặc nhận tại cửa hàng</p>
      </Button>

      <div className="space-y-2">
        <h2 className="font-medium">Sản phẩm tương tự</h2>
        <RelatedProducts products={relatedProducts} events={events} limit={3} />
      </div>
    </div>
  );
};
