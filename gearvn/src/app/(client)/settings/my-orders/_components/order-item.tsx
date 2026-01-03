import Link from "next/link";
import Image from "next/image";

import {
  Loader,
  Calendar,
  CreditCard,
  DollarSign,
  ShoppingBag,
} from "lucide-react";

import {
  getStatusIcon,
  getStatusColor,
  getPaymentStatusColor,
} from "@/utils/get/get-order-field";
import { cn } from "@/utils/cn";
import { formatPrice } from "@/utils/format/format-price";
import { formatDateVi } from "@/utils/format/format-date-vi";

import {
  ORDER_STATUS_VI,
  PAYMENT_METHOD_VI,
  PAYMENT_STATUS_VI,
} from "@/constants/admin/orders/convert-vi";
import { Order } from "@/types/order";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/config.global";
import { useCreatePayment } from "@/react-query/mutation/payment";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { ModalCancelOrder } from "@/components/modals/order/modal-cancel-order";

export const OrderItem = ({ order }: { order: Order }) => {
  const { mutate: createPayment, isPending } = useCreatePayment();

  const Icon = getStatusIcon(order.orderStatus);

  const handlePayment = () => {
    createPayment({
      orderId: order._id,
      amount: order.totalAmount,
      orderInfo: `Thanh toán đơn hàng ${order.orderCode}`,
    });
  };

  const showPaymentButton =
    order.paymentMethod === "VNPAY" &&
    order.orderStatus === ORDER_STATUS.PROCESSING &&
    order.paymentStatus === PAYMENT_STATUS.PENDING;

  return (
    <Card className="shadow-none">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          {/* Left: Title + Date */}
          <div className="space-y-1">
            <CardTitle className="text-lg truncate">
              Đơn hàng #{order.orderCode}
            </CardTitle>
            <time
              dateTime={formatDateVi(order.createdAt)}
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Calendar className="size-4" /> {formatDateVi(order.createdAt)}
            </time>
          </div>

          {/* Right: Status Badges */}
          <div className="flex flex-col sm:flex-row sm:items-center items-start gap-2 sm:gap-4">
            <Badge
              className={cn(
                "flex items-center gap-2",
                getStatusColor(order.orderStatus)
              )}
            >
              <Icon className="size-4" /> {ORDER_STATUS_VI[order.orderStatus]}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "flex items-center gap-2",
                getPaymentStatusColor(order.paymentStatus)
              )}
            >
              <CreditCard className="size-3" />{" "}
              {PAYMENT_STATUS_VI[order.paymentStatus]}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Phương thức thanh toán:</span>
          <span className="font-medium">
            {PAYMENT_METHOD_VI[order.paymentMethod]}
          </span>
        </div>

        <Separator />

        <div className="space-y-3">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <ShoppingBag className="size-4" /> Sản phẩm ({order.items.length})
          </h4>
          <div className="space-y-2">
            {order.items.map((item) => (
              <Link
                key={item.productId._id}
                href={`/products/${item.productId.slug}`}
                className="flex items-center gap-6 p-3"
              >
                <Image
                  width={80}
                  height={80}
                  loading="lazy"
                  alt={item.productId.name}
                  src={item.productId.images[0]}
                  className="object-contain"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium line-clamp-2">
                    {item.productId.name}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                    <span>Số lượng: {item.quantity}</span>
                    <span className="font-semibold text-primary">
                      {formatPrice(item.productId.discountPrice)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <Separator />

        <div className="flex justify-between items-center">
          <span className="flex items-center gap-2 text-muted-foreground">
            <DollarSign className="size-4" /> Tổng cộng:
          </span>
          <strong className="text-xl font-bold text-primary">
            {formatPrice(order.totalAmount)}
          </strong>
        </div>

        {order.note && (
          <>
            <Separator />
            <p className="text-sm text-muted-foreground italic">{order.note}</p>
          </>
        )}

        {order.orderStatus === ORDER_STATUS.PROCESSING &&
          order.paymentStatus !== PAYMENT_STATUS.PAID && (
            <>
              <Separator />
              <div className="flex justify-end gap-2">
                <ModalCancelOrder order={order}>
                  <Button variant="destructive" disabled={isPending}>
                    Hủy đơn hàng
                  </Button>
                </ModalCancelOrder>

                {showPaymentButton && (
                  <Button
                    disabled={isPending}
                    onClick={handlePayment}
                    className="text-green-800 hover:text-green-800 border-green-300 bg-green-100 border hover:bg-green-100"
                  >
                    {isPending && <Loader className="size-4 animate-spin" />}
                    Thanh toán
                  </Button>
                )}
              </div>
            </>
          )}
      </CardContent>
    </Card>
  );
};
