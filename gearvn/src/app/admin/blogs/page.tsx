import { Metadata } from "next";

import { PageClient } from ".";

export const metadata: Metadata = {
  title: "Quản lý bài viết - GEARVN.COM",
  description:
    "Trang quản lý bài viết trong hệ thống quản trị GEARVN: tạo mới, chỉnh sửa và quản lý các bài viết tin tức.",
};

export default function Page() {
  return <PageClient />;
}
