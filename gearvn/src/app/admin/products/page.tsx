import { Metadata } from "next";

import { PageClient } from ".";

export const metadata: Metadata = {
  title: "Quản lý sản phẩm - GEARVN.COM",
  description:
    "Trang quản lý sản phẩm trong hệ thống quản trị GEARVN: thêm, chỉnh sửa và theo dõi thông tin sản phẩm.",
};

export default function Page() {
  return <PageClient />;
}
