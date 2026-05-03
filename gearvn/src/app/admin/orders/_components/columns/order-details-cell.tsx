import Link from "next/link";
import Image from "next/image";

import { MapPin, Phone } from "lucide-react";

import { Order } from "@/types/order";

import { cn } from "@/utils/cn";
import { formatPrice } from "@/utils/format/format-price";
import { formatDateVi } from "@/utils/format/format-date-vi";
import { getOrderStatusUI } from "@/utils/get/get-order-status-ui";
import { getPaymentStatusUI } from "@/utils/get/get-payment-status-ui";

import {
  getOrderEventTypeVi,
  getOrderStatusVi,
  ORDER_DISPLAY_FALLBACK,
  ORDER_STATUS_VI,
} from "@/constants/admin/orders/convert-vi";
import {
  Sheet,
  SheetTitle,
  SheetHeader,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

const LEGACY_ORDER_STATUS_CHANGED_PATTERN = /^Order status changed from (\S+) to (\S+)$/;

const formatOrderStatusChangeMessage = (message?: string) => {
  const legacyMatch = message?.match(LEGACY_ORDER_STATUS_CHANGED_PATTERN);
  if (!legacyMatch) return message || ORDER_DISPLAY_FALLBACK;

  const fromStatus = getOrderStatusVi(legacyMatch[1]);
  const toStatus = getOrderStatusVi(legacyMatch[2]);
  if (fromStatus === ORDER_DISPLAY_FALLBACK || toStatus === ORDER_DISPLAY_FALLBACK) {
    return ORDER_DISPLAY_FALLBACK;
  }

  return `Trạng thái đơn hàng đã chuyển từ ${fromStatus} sang ${toStatus}.`;
};

const formatDateTime = (value?: string | Date) =>
  value ? formatDateVi(new Date(value)) : "Chưa ghi nhận";

export const OrderDetailsCell = ({ order }: { order: Order }) => {
  const { icon: Icon, label, className } = getOrderStatusUI(order.orderStatus);
  const {
    icon: PaymentIcon,
    label: paymentLabel,
    className: paymentClassName,
  } = getPaymentStatusUI(order.paymentStatus);

  const customer = order.userId;
  const customerEmail = customer?.email ?? "Khách vãng lai";
  const customerAvatar = customer?.avatarUrl || "/avatar-default.jpg";
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button className="font-semibold hover:text-primary hover:underline cursor-pointer">
          {order.orderCode}
        </button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-[650px] gap-0">
        <SheetHeader className="border-b pb-5">
          <SheetTitle className="text-lg font-semibold">
            Đơn hàng #{order.orderCode}
          </SheetTitle>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Ngày tạo: {formatDateVi(order.createdAt)}
            </p>

            <Badge
              variant="outline"
              className="w-fit flex items-center gap-2 px-3 py-1 text-sm font-medium"
            >
              <Icon className={cn("size-4", className)} />
              {label}
            </Badge>
          </div>
        </SheetHeader>

        <div className="p-5 space-y-6 overflow-y-auto custom-scroll">
          <section className="pb-5 border-b space-y-4">
            <h3 className="font-semibold text-base">Thông tin khách hàng và giao hàng</h3>
            <div className="flex items-center gap-3">
              <Image
                width={42}
                height={42}
                alt={order.fullName}
                src={customerAvatar}
                className="rounded-full object-cover"
              />
              <div>
                <p className="text-sm font-medium">{order.fullName}</p>
                <p className="text-sm text-muted-foreground">
                  {customerEmail}
                </p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Phone className="flex-shrink-0 size-4" />
                <span>{order.phone}</span>
              </div>

              <div className="flex items-start gap-2">
                <MapPin className="flex-shrink-0 size-4 mt-0.5" />
                <span>{order.address}</span>
              </div>

              {order.note && (
                <p className="italic text-muted-foreground">“{order.note}”</p>
              )}
            </div>
          </section>

          <section className="pb-5 border-b space-y-3">
            <h3 className="font-semibold text-base">Thanh toán</h3>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground">Phương thức</p>
                <p className="font-medium">{order.paymentMethod}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Trạng thái</p>
                <Badge variant="outline" className="mt-1 w-fit flex items-center gap-2">
                  <PaymentIcon className={cn("size-4", paymentClassName)} />
                  {paymentLabel}
                </Badge>
              </div>
              {order.paymentProvider && (
                <div>
                  <p className="text-muted-foreground">Cổng thanh toán</p>
                  <p className="font-medium">{order.paymentProvider}</p>
                </div>
              )}
              {order.paymentReference && (
                <div>
                  <p className="text-muted-foreground">Mã tham chiếu</p>
                  <p className="font-medium break-all">{order.paymentReference}</p>
                </div>
              )}
              {order.paymentAmount != null && (
                <div>
                  <p className="text-muted-foreground">Số tiền ghi nhận</p>
                  <p className="font-medium">{formatPrice(order.paymentAmount)}</p>
                </div>
              )}
              {order.paymentReconciledAt && (
                <div>
                  <p className="text-muted-foreground">Đối soát lúc</p>
                  <p className="font-medium">{formatDateTime(order.paymentReconciledAt)}</p>
                </div>
              )}
            </div>
          </section>

          <section className="pb-5 border-b space-y-3">
            <h3 className="font-semibold text-base">Sản phẩm</h3>
            <div className="space-y-4">
              {order.items.map((item, idx) => {
                const productId = item.productId._id;
                const productImage =
                  item.productImage || item.productId.images?.[0] || "/avatar-default.jpg";
                const productName = item.productName || item.productId.name;

                return (
                  <Link
                    key={`${productId}-${idx}`}
                    href={`/admin/products/${productId}`}
                    className="flex gap-3 pb-3 border-b last:border-none"
                  >
                    <Image
                      width={64}
                      height={64}
                      alt={productName}
                      src={productImage}
                      className="object-contain rounded"
                    />

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{productName}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.quantity} x {formatPrice(item.finalPrice)}
                      </p>
                      <div className="mt-1 flex items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">
                          Giá gốc: {formatPrice(item.unitPrice)}
                        </p>
                        <p className="font-semibold text-primary">
                          {formatPrice(item.lineTotal)}
                        </p>
                      </div>
                      {(item.eventName || item.promotionStatus) && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.eventName ?? item.eventTag ?? "Khuyến mãi"} · {item.promotionStatus ?? "snapshot"}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="pb-5 border-b space-y-3">
            <h3 className="font-semibold text-base">Ảnh chụp khuyến mãi</h3>
            <div className="space-y-2 text-sm">
              {(order.promotionAdjustments?.length ?? 0) > 0 ? (
                order.promotionAdjustments?.map((adjustment, index) => (
                  <div
                    key={`${adjustment.type}-${adjustment.code ?? adjustment.eventTag ?? index}`}
                    className="flex items-start justify-between gap-3"
                  >
                    <div>
                      <p className="font-medium">
                        {adjustment.description ?? adjustment.eventName ?? adjustment.voucherCode ?? adjustment.type}
                      </p>
                      <p className="text-muted-foreground">
                        {adjustment.eventTag ?? adjustment.voucherCode ?? adjustment.code ?? "Đã lưu trên đơn"}
                      </p>
                    </div>
                    <p className="font-semibold">-{formatPrice(adjustment.amount)}</p>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">Không có khuyến mãi áp dụng.</p>
              )}

              {order.voucherSnapshot && (
                <div className="pt-2 border-t">
                  <p className="font-medium">Voucher {order.voucherSnapshot.code}</p>
                  {order.voucherSnapshot.discountAmount != null && (
                    <p className="text-muted-foreground">
                      Giảm {formatPrice(order.voucherSnapshot.discountAmount)}
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>

          <section className="pb-5 border-b space-y-3">
            <h3 className="font-semibold text-base">Trạng thái hiện tại</h3>
            <Badge variant="outline" className="w-fit flex items-center gap-2 px-3 py-1">
              <Icon className={cn("size-4", className)} />
              {label}
            </Badge>
          </section>

          <section className="pb-5 border-b space-y-3">
            <h3 className="font-semibold text-base">Lịch sử trạng thái</h3>
            {(order.statusHistory?.length ?? 0) > 0 ? (
              <div className="space-y-3 text-sm">
                {order.statusHistory?.map((entry, index) => (
                  <div key={`${entry.changedAt}-${index}`} className="space-y-1">
                    <p className="font-medium">
                      {ORDER_STATUS_VI[entry.fromStatus] ?? ORDER_DISPLAY_FALLBACK} → {ORDER_STATUS_VI[entry.toStatus] ?? ORDER_DISPLAY_FALLBACK}
                    </p>
                    <p className="text-muted-foreground">
                      {formatDateTime(entry.changedAt)}
                      {entry.changedByRole ? ` · ${entry.changedByRole}` : ""}
                    </p>
                    {entry.reason && <p className="text-muted-foreground">{entry.reason}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Chưa có lịch sử trạng thái.</p>
            )}
          </section>

          {order.cancellationReason && (
            <section className="pb-5 border-b space-y-2">
              <h3 className="font-semibold text-base">Lý do hủy</h3>
              <p className="text-sm text-muted-foreground">{order.cancellationReason}</p>
              {order.cancelledAt && (
                <p className="text-sm text-muted-foreground">
                  Ghi nhận lúc {formatDateTime(order.cancelledAt)}
                </p>
              )}
            </section>
          )}

          <section className="pb-5 border-b space-y-3">
            <h3 className="font-semibold text-base">Sự kiện đơn hàng</h3>
            {(order.orderEvents?.length ?? 0) > 0 ? (
              <div className="space-y-3 text-sm">
                {order.orderEvents?.map((event, index) => (
                  <div key={`${event.createdAt}-${index}`} className="space-y-1">
                    <p className="font-medium">{formatOrderStatusChangeMessage(event.message)}</p>
                    <p className="text-muted-foreground">
                      {getOrderEventTypeVi(event.type)} · {formatDateTime(event.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Chưa có sự kiện vận hành.</p>
            )}
          </section>

          <section className="flex justify-between text-base font-semibold">
            <span>Tổng cộng</span>
            <span className="text-primary">{formatPrice(order.totalAmount)}</span>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
};
