import Link from "next/link";
import Image from "next/image";

import { Phone, MapPin } from "lucide-react";

import { Order } from "@/types/order";

import { cn } from "@/utils/cn";
import { formatPrice } from "@/utils/format/format-price";
import { formatDateVi } from "@/utils/format/format-date-vi";
import { getOrderStatusUI } from "@/utils/get/get-order-status-ui";

import {
  Sheet,
  SheetTitle,
  SheetHeader,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

export const OrderDetailsCell = ({ order }: { order: Order }) => {
  const { icon: Icon, label, className } = getOrderStatusUI(order.orderStatus);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button className="font-semibold hover:text-primary hover:underline cursor-pointer">
          {order.orderCode}
        </button>
      </SheetTrigger>

      <SheetContent side="right" className="w-[650px] gap-0">
        <SheetHeader className="border-b pb-5">
          <SheetTitle className="text-xl font-bold">
            Đơn hàng #{order.orderCode}
          </SheetTitle>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground mt-1">
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

        <div className="p-5 space-y-8 overflow-y-auto custom-scroll">
          <section className="pb-5 border-b space-y-4">
            <h3 className="font-semibold text-lg">Thông tin khách hàng</h3>
            <div className="flex items-center gap-3">
              <Image
                width={42}
                height={42}
                alt={order.fullName}
                src={order.userId.avatarUrl || "/avatar-default.jpg"}
                className="rounded-full object-cover"
              />
              <div>
                <p className="text-[15px] font-medium">{order.fullName}</p>
                <p className="text-[13px] text-muted-foreground">
                  {order.userId.email}
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

          <section>
            <h3 className="font-semibold text-base mb-3">Sản phẩm</h3>
            <div className="space-y-4">
              {order.items.map((item, idx) => (
                <Link
                  key={idx}
                  href={`/admin/products/${btoa(item.productId._id)}`}
                  className="flex gap-3 pb-3 border-b last:border-none"
                >
                  <Image
                    width={64}
                    height={64}
                    alt={item.productId.name}
                    src={item.productId.images?.[0]}
                    className="object-contain rounded"
                  />

                  <div className="flex-1">
                    <p className="font-medium">{item.productId.name}</p>
                    <div className="flex justify-between mt-1">
                      <p className="text-sm text-muted-foreground">
                        {item.quantity} × {formatPrice(item.productId.price)}
                      </p>
                      <p className="text-primary font-semibold">
                        {formatPrice(item.productId.price * item.quantity)}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="border-t pt-5 flex justify-between text-lg font-bold">
            <span>Tổng cộng</span>
            <span className="text-primary">
              {formatPrice(order.totalAmount)}
            </span>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
};
