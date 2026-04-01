"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, TicketPercent, X } from "lucide-react";

import { VOUCHER_DISCOUNT_TYPE } from "@/config.global";
import { usePublicVouchers, useValidateVoucher } from "@/react-query/query/voucher";
import { useOrderStore } from "@/stores/use-order-store";
import { VoucherFailureCode, VoucherType } from "@/types/voucher";
import { formatPrice } from "@/utils/format/format-price";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type VoucherBoxProps = {
  subtotal: number;
};

const voucherReasonByCode: Record<VoucherFailureCode, string> = {
  VOUCHER_INVALID: "Mã không hợp lệ",
  VOUCHER_EXPIRED: "Mã đã hết hạn",
  VOUCHER_USAGE_LIMIT: "Mã đã hết lượt",
  VOUCHER_MINIMUM_NOT_MET: "Đơn hàng chưa đạt giá trị tối thiểu",
  VOUCHER_NOT_ACTIVE: "Mã chưa đến thời gian áp dụng",
};

const describeVoucher = (voucher: VoucherType) => {
  if (voucher.discountType === VOUCHER_DISCOUNT_TYPE.PERCENTAGE) {
    const capped = voucher.maximumDiscountAmount
      ? `, tối đa ${formatPrice(voucher.maximumDiscountAmount)}`
      : "";
    return `Giảm ${voucher.discountValue}%${capped}`;
  }

  return `Giảm ${formatPrice(voucher.discountValue)}`;
};

const getVoucherErrorReason = (error: unknown) => {
  const detail = (error as { detail?: { code?: VoucherFailureCode } })?.detail;
  if (detail?.code && voucherReasonByCode[detail.code]) {
    return voucherReasonByCode[detail.code];
  }

  return "Mã không hợp lệ";
};

export const VoucherBox = ({ subtotal }: VoucherBoxProps) => {
  const [draftCode, setDraftCode] = useState("");
  const [pendingReplacementCode, setPendingReplacementCode] = useState("");
  const [warning, setWarning] = useState("");

  const {
    voucherCode,
    voucherDiscountAmount,
    voucherDescription,
    setVoucher,
    clearVoucher,
  } = useOrderStore();

  const { data: publicVouchers = [], isLoading } = usePublicVouchers({
    subtotal,
  });
  const { mutate: validateVoucher, isPending } = useValidateVoucher();

  const normalizedDraftCode = draftCode.trim().toUpperCase();
  const availableVouchers = useMemo(
    () => publicVouchers.slice(0, 4),
    [publicVouchers]
  );

  const applyVoucher = (code: string) => {
    setWarning("");
    validateVoucher(
      { code, subtotal },
      {
        onSuccess: (voucher) => {
          setVoucher({
            voucherCode: voucher.code,
            voucherDiscountAmount: voucher.discountAmount,
            voucherDescription: describeVoucher(voucher),
            voucherAppliedSubtotal: subtotal,
          });
          setDraftCode("");
          setPendingReplacementCode("");
        },
        onError: (error) => {
          setWarning(getVoucherErrorReason(error));
          setPendingReplacementCode("");
        },
      }
    );
  };

  const handleApply = () => {
    if (!normalizedDraftCode) {
      setWarning("Mã không hợp lệ");
      return;
    }

    if (voucherCode && normalizedDraftCode !== voucherCode) {
      setPendingReplacementCode(normalizedDraftCode);
      setWarning("");
      return;
    }

    applyVoucher(normalizedDraftCode);
  };

  return (
    <section className="border rounded-sm p-4 space-y-4">
      <div className="flex items-center gap-2">
        <TicketPercent className="size-5 text-primary" />
        <h3 className="text-base font-semibold">Mã giảm giá</h3>
      </div>

      {voucherCode && (
        <div className="flex items-center justify-between gap-3 rounded-sm border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4" />
            <span>
              Đã áp dụng {voucherCode}
              {voucherDiscountAmount ? ` - ${formatPrice(voucherDiscountAmount)}` : ""}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              clearVoucher();
              setWarning("");
            }}
            aria-label="Gỡ mã giảm giá"
            className="text-green-800 hover:text-destructive"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={draftCode}
          onChange={(event) => setDraftCode(event.target.value)}
          placeholder="Nhập mã giảm giá"
          aria-invalid={!!warning}
          className="h-12 uppercase"
        />
        <Button
          type="button"
          disabled={isPending}
          onClick={handleApply}
          className="h-12 rounded-sm"
        >
          Áp dụng mã
        </Button>
      </div>

      {voucherDescription && voucherCode && (
        <p className="text-sm text-muted-foreground">{voucherDescription}</p>
      )}

      {pendingReplacementCode && (
        <div className="rounded-sm border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p>
            Bạn đang dùng {voucherCode}. Thay bằng {pendingReplacementCode}?
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => applyVoucher(pendingReplacementCode)}
              className="rounded-sm"
            >
              Thay mã
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setPendingReplacementCode("")}
              className="rounded-sm"
            >
              Giữ mã cũ
            </Button>
          </div>
        </div>
      )}

      {warning && (
        <p className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
          {warning}
        </p>
      )}

      <div className="space-y-2">
        <p className="text-sm font-semibold">Mã có thể dùng</p>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Đang tải mã giảm giá...</p>
        ) : availableVouchers.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {availableVouchers.map((voucher) => (
              <button
                type="button"
                key={voucher._id ?? voucher.code}
                onClick={() => setDraftCode(voucher.code)}
                className="rounded-sm border px-3 py-2 text-left text-sm hover:border-primary"
              >
                <Badge variant="secondary" className="mb-1">
                  {voucher.code}
                </Badge>
                <span className="block text-muted-foreground">
                  {describeVoucher(voucher)}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Chưa có mã giảm giá phù hợp cho đơn hàng này.
          </p>
        )}
      </div>
    </section>
  );
};
