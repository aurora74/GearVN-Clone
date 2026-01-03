import { Metadata } from "next";

import { PageClient } from ".";

export const metadata: Metadata = {
  title: "Trang quản trị - GEARVN.COM",
  description:
    "Trang tổng quan quản trị dành cho quản lý sản phẩm, đơn hàng và khách hàng tại GEARVN.",
};

export default function Page() {
  return <PageClient />;
}
