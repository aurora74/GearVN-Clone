import { Badge } from "@/components/ui/badge";
import { PromotionStatus } from "@/types/event";
import { VoucherStatus } from "@/types/voucher";

const flashSaleLabels: Record<PromotionStatus, string> = {
  scheduled: "Sắp diễn ra",
  active: "Đang chạy",
  ended: "Đã kết thúc",
  disabled: "Đã tắt",
};

const voucherLabels: Record<VoucherStatus, string> = {
  scheduled: "Chưa bắt đầu",
  active: "Đang áp dụng",
  exhausted: "Hết lượt",
  expired: "Hết hạn",
  disabled: "Đã tắt",
};

const stateClassName = {
  scheduled: "border-blue-200 bg-blue-50 text-blue-700",
  active: "border-primary/20 bg-primary/10 text-primary",
  ended: "border-muted bg-muted text-muted-foreground",
  expired: "border-muted bg-muted text-muted-foreground",
  exhausted: "border-amber-200 bg-amber-50 text-amber-700",
  disabled: "border-muted bg-muted text-muted-foreground",
} as const;

type FlashSaleStatusBadgeProps = {
  status?: PromotionStatus;
};

type VoucherStatusBadgeProps = {
  status?: VoucherStatus;
};

export const FlashSaleStatusBadge = ({ status }: FlashSaleStatusBadgeProps) => {
  const key = status ?? "scheduled";

  return (
    <Badge variant="outline" className={stateClassName[key]}>
      {flashSaleLabels[key]}
    </Badge>
  );
};

export const VoucherStatusBadge = ({ status }: VoucherStatusBadgeProps) => {
  const key = status ?? "scheduled";

  return (
    <Badge variant="outline" className={stateClassName[key]}>
      {voucherLabels[key]}
    </Badge>
  );
};
