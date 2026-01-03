"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { CheckCircle, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

import { OrderDetailsCard } from "./order-details-card";

const getStatusConfig = (isSuccess: boolean) => {
  if (isSuccess) {
    return {
      icon: <CheckCircle className="text-green-500" size={64} />,
      title: "Đặt hàng thành công",
      titleClass: "text-green-500",
      message: (
        <>
          Cảm ơn bạn đã mua hàng tại <strong>GearVN</strong>. <br />
          Vui lòng kiểm tra email để xác nhận đơn hàng và thông tin vận chuyển.
        </>
      ),
    };
  } else {
    return {
      icon: <XCircle className="text-red-500" size={64} />,
      title: "Thanh toán thất bại",
      titleClass: "text-red-500",
      message: (
        <>
          Có lỗi xảy ra trong quá trình thanh toán. <br />
          Vui lòng thử lại hoặc liên hệ hỗ trợ qua{" "}
          <a
            href="tel:19005301"
            className="text-blue-500 font-semibold underline"
            title="Gọi hỗ trợ 1900.5301"
          >
            1900.5301
          </a>
          .
        </>
      ),
    };
  }
};

export const CompleteStep = () => {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");

  const isSuccess = status === "success";
  const statusConfig = getStatusConfig(isSuccess);

  return (
    <div className="pt-6 space-y-8 text-center">
      <div role="status" className="flex flex-col items-center gap-2">
        {statusConfig.icon}
        <h1 className={`text-2xl font-semibold ${statusConfig.titleClass}`}>
          {statusConfig.title}
        </h1>
        <p className="text-muted-foreground">{statusConfig.message}</p>
      </div>

      {isSuccess && <OrderDetailsCard />}

      <Button
        asChild
        aria-label="Tiếp tục mua hàng"
        title="Tiếp tục mua hàng tại cửa hàng"
        className="w-full h-12 text-lg uppercase rounded-sm mt-4"
      >
        <Link href="/" className="block w-full text-center">
          Tiếp tục mua hàng
        </Link>
      </Button>
    </div>
  );
};
