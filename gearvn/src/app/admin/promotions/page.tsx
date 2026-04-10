import { Metadata } from "next";

import { PageClient } from ".";

export const metadata: Metadata = {
  title: "Quản lý khuyến mãi - GEARVN.COM",
  description:
    "Trang quản lý flash sale, voucher và sản phẩm khuyến mãi trong hệ thống quản trị GEARVN.",
};

export default function Page() {
  return <PageClient />;
}
