import { Metadata } from "next";

import { Breadcrumbs } from "@/components/global/breadcrumbs";

import { OrderLookupClient } from "./_components/order-lookup-client";

const breadcrumbs = [
  { label: "Trang chủ", href: "/" },
  { label: "Tra cứu đơn hàng", href: "/orders/lookup" },
];

export const metadata: Metadata = {
  title: "Tra cứu đơn hàng | GEARVN",
  description:
    "Tra cứu nhanh thông tin đơn hàng của bạn bằng mã đơn hàng tại GEARVN.",
};

export default function OrderLookupPage() {
  return (
    <div className="bg-[#f7f8f9]">
      <Breadcrumbs items={breadcrumbs} />
      <OrderLookupClient />
    </div>
  );
}
