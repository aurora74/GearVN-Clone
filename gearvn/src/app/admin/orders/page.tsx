import { Metadata } from "next";

import { PageClient } from ".";

export const metadata: Metadata = {
  title: "Quản lý đơn hàng - GEARVN.COM",
  description:
    "Trang quản lý đơn hàng trong hệ thống quản trị GEARVN: theo dõi trạng thái, chi tiết và lịch sử đơn hàng.",
};

export default function Page() {
  return <PageClient />;
}
