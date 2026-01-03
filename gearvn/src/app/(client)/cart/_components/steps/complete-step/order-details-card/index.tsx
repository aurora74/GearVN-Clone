"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { MapPin, Phone, User } from "lucide-react";

import { formatPrice } from "@/utils/format/format-price";
import { useOrder } from "@/react-query/query/order";

import { InfoRow } from "../info-row";
import { NoResults } from "../no-results";

import { Separator } from "@/components/ui/separator";

import { OrderItemRow } from "./order-item-row";
import { OrderDetailsSkeleton } from "./order-details-skeleton";

export const OrderDetailsCard = () => {
  const searchParams = useSearchParams();
  const orderIdParam = searchParams.get("orderId");

  let orderId: string | null = null;
  try {
    orderId = orderIdParam ? atob(orderIdParam) : null;
  } catch {
    orderId = null;
  }

  const { data: order, isPending } = useOrder(orderId ?? "");

  if (isPending) return <OrderDetailsSkeleton />;
  if (!order) return <NoResults />;

  return (
    <div className="w-full p-4 sm:p-6 border rounded-md space-y-4 bg-white">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p className="text-lg font-semibold uppercase">
          Đơn hàng #{order.orderCode}
        </p>
        <Link
          href="/settings/my-orders"
          className="text-blue-500 font-semibold hover:underline text-sm"
        >
          Quản lý đơn hàng
        </Link>
      </div>

      <Separator />

      <div className="space-y-2 text-sm">
        <InfoRow
          label="Họ tên"
          value={order.fullName}
          icon={<User className="size-4 mt-0.5" />}
        />
        <InfoRow
          label="Số điện thoại"
          value={order.phone}
          icon={<Phone className="size-4 mt-0.5" />}
        />
        <InfoRow
          label="Địa chỉ"
          value={order.address}
          icon={<MapPin className="size-4 mt-0.5" />}
        />
      </div>

      <Separator />

      <div className="space-y-6">
        {order.items.map((item) => (
          <OrderItemRow key={item.productId._id} item={item} />
        ))}
      </div>

      <Separator />

      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span>Tạm tính:</span>
          <span className="font-medium">{formatPrice(order.totalAmount)}</span>
        </div>
        <div className="flex justify-between">
          <span>Phí vận chuyển:</span>
          <span className="font-medium">Miễn phí</span>
        </div>
      </div>

      <Separator />

      <div className="flex justify-between font-semibold text-lg sm:text-xl">
        <span>Tổng cộng:</span>
        <span className="text-primary">{formatPrice(order.totalAmount)}</span>
      </div>

      <p className="text-sm font-medium text-red-500 italic text-start">
        * Tuyệt đối không chuyển khoản cho Shipper trước khi nhận hàng.
      </p>
    </div>
  );
};
