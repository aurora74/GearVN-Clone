import { Metadata } from "next";

import CreateBlogPage from ".";

export const metadata: Metadata = {
  title: "Tạo bài viết mới - GEARVN.COM",
  description:
    "Trang tạo bài viết mới trong hệ thống quản trị GEARVN. Nhập tiêu đề, nội dung và hình ảnh để đăng bài viết mới lên website.",
};

export default function Page() {
  return <CreateBlogPage />;
}
