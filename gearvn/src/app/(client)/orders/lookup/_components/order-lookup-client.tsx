"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { ClipboardList, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ORDER_STATUS_VI,
  PAYMENT_METHOD_VI,
  PAYMENT_STATUS_VI,
} from "@/constants/admin/orders/convert-vi";
import { useOrderByCode } from "@/react-query/query/order";
import { useMe } from "@/react-query/query/user";
import { useAuthModal } from "@/stores/use-auth-modal";

const NOT_FOUND_COPY =
  "Không tìm thấy đơn hàng. Kiểm tra lại mã đơn hàng hoặc xem danh sách đơn hàng của bạn.";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (value: string | Date) =>
  new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export const OrderLookupClient = () => {
  const { data: user, isPending: isUserPending } = useMe();
  const { setModal } = useAuthModal();
  const [orderCode, setOrderCode] = useState("");
  const [submittedCode, setSubmittedCode] = useState("");

  const lookupCode = user ? submittedCode : "";
  const {
    data: order,
    isFetching,
    isError,
  } = useOrderByCode(lookupCode);

  const fields = useMemo(() => {
    if (!order) return [];

    return [
      { label: "Mã đơn hàng", value: order.orderCode },
      { label: "Ngày đặt", value: formatDate(order.createdAt) },
      { label: "Tổng tiền", value: formatCurrency(order.totalAmount) },
      {
        label: "Trạng thái đơn hàng",
        value: ORDER_STATUS_VI[order.orderStatus] ?? order.orderStatus,
      },
      {
        label: "Trạng thái thanh toán",
        value: PAYMENT_STATUS_VI[order.paymentStatus] ?? order.paymentStatus,
      },
      {
        label: "Phương thức thanh toán",
        value: PAYMENT_METHOD_VI[order.paymentMethod] ?? order.paymentMethod,
      },
      { label: "Số sản phẩm", value: `${order.items.length} sản phẩm` },
    ];
  }, [order]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmittedCode(orderCode.trim());
  };

  const isGuest = !isUserPending && !user;
  const hasSubmittedCode = submittedCode.length > 0;

  return (
    <main className="wrapper py-4 pb-16">
      <Card className="mx-auto max-w-3xl rounded-lg bg-white shadow-sm">
        <CardHeader className="gap-2">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <ClipboardList className="size-5" aria-hidden="true" />
            </span>
            <div>
              <CardTitle className="text-xl font-semibold">
                Tra cứu đơn hàng
              </CardTitle>
              <CardDescription>
                Nhập mã đơn hàng để xem thông tin chi tiết.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <form className="space-y-3" onSubmit={handleSubmit}>
            <label className="block text-sm font-medium" htmlFor="order-code">
              Mã đơn hàng
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                id="order-code"
                value={orderCode}
                placeholder="Nhập mã đơn hàng của bạn"
                onChange={(event) => setOrderCode(event.target.value)}
                disabled={isGuest}
                className="h-10"
              />
              <Button
                type="submit"
                className="h-10 sm:w-auto"
                disabled={isGuest || isFetching || !orderCode.trim()}
              >
                <Search className="size-4" aria-hidden="true" />
                Tra cứu đơn hàng
              </Button>
            </div>
          </form>

          <div className="flex flex-col gap-3 rounded-md border bg-secondary/40 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground">
              Nhập mã đơn hàng để xem thông tin chi tiết.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/settings/my-orders">Xem tất cả đơn hàng</Link>
            </Button>
          </div>

          {isGuest ? (
            <div className="rounded-md border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm font-medium">
                Đăng nhập để tra cứu đơn hàng của bạn.
              </p>
              <Button
                type="button"
                size="sm"
                className="mt-3"
                onClick={() => setModal("login")}
              >
                Đăng nhập
              </Button>
            </div>
          ) : null}

          {isFetching ? (
            <p className="rounded-md border bg-white p-4 text-sm text-muted-foreground">
              Đang tra cứu đơn hàng...
            </p>
          ) : null}

          {isError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm font-medium text-destructive">
              {NOT_FOUND_COPY}
            </p>
          ) : null}

          {!isGuest && !isFetching && !isError && !order && !hasSubmittedCode ? (
            <p className="rounded-md border bg-white p-4 text-sm text-muted-foreground">
              Nhập mã đơn hàng để xem thông tin chi tiết.
            </p>
          ) : null}

          {order ? (
            <section
              aria-label="Thông tin đơn hàng"
              className="rounded-md border bg-white p-4"
            >
              <dl className="grid gap-4 sm:grid-cols-2">
                {fields.map((field) => (
                  <div key={field.label} className="space-y-1">
                    <dt className="text-sm text-muted-foreground">
                      {field.label}
                    </dt>
                    <dd className="font-semibold">{field.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
};
