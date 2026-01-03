"use client";

import Link from "next/link";
import { useState, useMemo } from "react";

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

export const ProductInfo = ({
  events,
  product,
  relatedProducts,
}: ProductInfoProps) => {
  const [quantity, setQuantity] = useState(1);

  const { role } = useRoleStore();
  const { setModal } = useAuthModal();
  const { addToCart } = useCartStore();

  const finalPrice = useMemo(
    () => calculateFinalPrice(product.price, product.discountPercent),
    [product.price, product.discountPercent]
  );

  const increase = () => setQuantity((q) => q + 1);
  const decrease = () => setQuantity((q) => Math.max(1, q - 1));

  const handleAddToCart = () => {
    if (!role) return setModal("login");

    addToCart({
      quantity,
      finalPrice,
      id: product._id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      image: product.images?.[0],
      discountPercent: product.discountPercent ?? 0,
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

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
        <p className="text-3xl font-bold text-primary">
          {formatPrice(finalPrice)}
        </p>
        <div className="flex items-center gap-3">
          {product.price && (
            <p className="text-lg font-medium text-muted-foreground line-through">
              {formatPrice(product.price)}
            </p>
          )}
          {product.discountPercent && (
            <p className="text-[13px] text-primary py-0.5 px-2.5 border border-primary bg-primary/10 rounded-sm">
              -{product.discountPercent}%
            </p>
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
        />
      </div>

      <Button
        onClick={handleAddToCart}
        aria-label="Mua ngay sản phẩm"
        disabled={role === USER_ROLE.ADMIN}
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
