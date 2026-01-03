import { Metadata } from "next";

import { PageClient } from ".";

export const metadata: Metadata = {
  title: "Quản lý danh mục - GEARVN.COM",
  description:
    "Trang quản lý danh mục sản phẩm trong hệ thống quản trị GEARVN: thêm, chỉnh sửa và quản lý các danh mục.",
};

export default function Page() {
  return <PageClient />;
}
