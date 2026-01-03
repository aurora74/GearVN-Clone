import { Metadata } from "next";

import { PageClient } from ".";

export const metadata: Metadata = {
  title: "Quản lý khách hàng - GEARVN.COM",
  description:
    "Trang quản lý khách hàng trong hệ thống quản trị GEARVN: theo dõi thông tin, trạng thái và lịch sử mua hàng.",
};

export default function Page() {
  return <PageClient />;
}
