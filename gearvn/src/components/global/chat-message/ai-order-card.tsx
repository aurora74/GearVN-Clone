import Link from "next/link";

import { AssistantOrderCard } from "@/types/chat";
import { formatPrice } from "@/utils/format/format-price";

type AiOrderCardProps = {
  order?: AssistantOrderCard;
  isAuthenticated: boolean;
};

const toDisplayText = (value: unknown) => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  return "";
};

const formatDate = (value?: unknown) => {
  const displayValue = toDisplayText(value);
  if (!displayValue) return "";
  const date = new Date(displayValue);
  if (Number.isNaN(date.getTime())) return displayValue;
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const toDisplayPrice = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

export const AiOrderCard = ({ order, isAuthenticated }: AiOrderCardProps) => {
  if (!isAuthenticated) {
    return (
      <div className="w-full rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        Đăng nhập để xem đơn hàng
      </div>
    );
  }

  if (!order) {
    return (
      <div className="w-full rounded-md border border-gray-200 bg-white p-3 text-sm text-gray-600">
        Chưa có đơn hàng phù hợp
      </div>
    );
  }

  const orderLabel =
    toDisplayText(order.orderCode) || toDisplayText(order.orderId) || "Đơn hàng";
  const createdAtLabel = formatDate(order.createdAt);
  const statusLabel = toDisplayText(order.status) || "Không rõ trạng thái";
  const paymentStatusLabel = toDisplayText(order.paymentStatus);
  const total = toDisplayPrice(order.total);
  const itemNames = (Array.isArray(order.items) ? order.items : [])
    .map((item) => toDisplayText(item?.name))
    .filter(Boolean)
    .slice(0, 2);

  return (
    <div className="w-full space-y-2 rounded-md border border-gray-200 bg-white p-3 text-gray-900 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{orderLabel}</p>
          {createdAtLabel && (
            <p className="text-xs text-gray-500">{createdAtLabel}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          <span className="rounded-sm bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700">
            {statusLabel}
          </span>
          {paymentStatusLabel && (
            <span className="rounded-sm bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
              {paymentStatusLabel}
            </span>
          )}
        </div>
      </div>

      {total != null && (
        <p className="text-sm font-semibold text-primary">
          {formatPrice(total)}
        </p>
      )}

      {itemNames.length > 0 && (
        <p className="line-clamp-2 text-xs text-gray-600">
          {itemNames.join(", ")}
        </p>
      )}

      <Link
        href="/settings/my-orders"
        className="inline-flex min-h-11 items-center justify-center rounded-md border border-primary px-3 text-xs font-medium text-primary transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        Xem đơn hàng
      </Link>
    </div>
  );
};
