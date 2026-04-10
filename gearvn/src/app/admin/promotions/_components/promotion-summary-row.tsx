"use client";

import { BadgePercent, BarChart3, TicketPercent, Timer } from "lucide-react";

import { usePromotionSummary } from "@/react-query/query/promotion";
import { formatPrice } from "@/utils/format/format-price";

const summaryItems = [
  {
    key: "activeFlashSales",
    label: "Flash sale đang chạy",
    icon: Timer,
  },
  {
    key: "totalVoucherUses",
    label: "Lượt dùng voucher",
    icon: TicketPercent,
  },
  {
    key: "totalDiscountedAmount",
    label: "Tổng giảm giá",
    icon: BadgePercent,
    format: formatPrice,
  },
  {
    key: "flashSaleProductsCount",
    label: "Sản phẩm flash sale",
    icon: BarChart3,
  },
] as const;

export const PromotionSummaryRow = () => {
  const { data, isPending } = usePromotionSummary();

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {summaryItems.map((item) => {
        const Icon = item.icon;
        const rawValue = data?.[item.key] ?? 0;
        const value = "format" in item ? item.format(rawValue) : rawValue;

        return (
          <div
            key={item.key}
            className="flex min-h-20 items-center justify-between rounded-md border bg-secondary/40 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-xl font-semibold">
                {isPending ? "..." : value}
              </p>
            </div>
            <Icon className="size-5 shrink-0 text-primary" />
          </div>
        );
      })}
    </div>
  );
};
