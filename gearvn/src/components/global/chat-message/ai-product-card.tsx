import Image from "next/image";
import Link from "next/link";

import {
  AssistantActionDraft,
  AssistantProductCard as ProductCard,
} from "@/types/chat";
import { cn } from "@/utils/cn";
import { formatPrice } from "@/utils/format/format-price";

type AiProductCardProps = {
  product: ProductCard;
  addDraft?: AssistantActionDraft;
  pendingDraftId?: string | null;
  onConfirmAction?: (draft: AssistantActionDraft) => void;
};

const getProductHref = (product: ProductCard) =>
  product.detailHref ||
  (product.slug
    ? `/products/${product.slug}`
    : `/products/${product.productId}`);

export const AiProductCard = ({
  product,
  addDraft,
  pendingDraftId,
  onConfirmAction,
}: AiProductCardProps) => {
  const currentPrice = product.discountPrice ?? product.price;
  const isAddable =
    product.availability?.addable ??
    (typeof product.stock === "number" ? product.stock > 0 : true);
  const stockLabel =
    product.availability?.status === "unavailable"
      ? "Tạm ngừng bán"
      : isAddable
        ? `Còn ${product.stock ?? "hàng"}`
        : "Hết hàng";
  const canAdd = Boolean(
    addDraft &&
    isAddable &&
    (product.actionPayload?.actions.includes("ADD_TO_CART") ?? true),
  );
  const isPending = pendingDraftId === addDraft?.draftId;
  const primaryReason = product.reasons?.[0];

  return (
    <div className="w-full rounded-md border border-gray-200 bg-white p-2 text-gray-900 shadow-sm">
      <div className="flex min-w-0 gap-2">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded border bg-gray-50">
          {product.image ? (
            <Image
              fill
              unoptimized
              alt={product.name}
              src={product.image}
              className="object-contain"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">
              GearVN
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <p className="line-clamp-2 text-sm font-semibold leading-5">
            {product.name}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {currentPrice != null && (
              <span className="font-semibold text-primary">
                {formatPrice(currentPrice)}
              </span>
            )}
            {product.discountPrice && product.price && (
              <span className="text-gray-400 line-through">
                {formatPrice(product.price)}
              </span>
            )}
            <span
              className={cn(
                "rounded-sm px-1.5 py-0.5 text-[11px]",
                isAddable
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-gray-100 text-gray-500",
              )}
            >
              {stockLabel}
            </span>
          </div>
          {primaryReason && (
            <p className="line-clamp-2 text-xs text-gray-600">
              {primaryReason}
            </p>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <Link
          href={getProductHref(product)}
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-primary px-3 text-xs font-medium text-primary transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Xem sản phẩm
        </Link>
        {canAdd && addDraft && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => onConfirmAction?.(addDraft)}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-white transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-wait disabled:opacity-70"
          >
            Thêm vào giỏ
          </button>
        )}
      </div>
    </div>
  );
};
