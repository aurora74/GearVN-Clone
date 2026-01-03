import { Metadata } from "next";

import EditBlogPage from ".";

export const metadata: Metadata = {
  title: "Chỉnh sửa bài viết - GEARVN.COM",
  description:
    "Trang chỉnh sửa bài viết trong hệ thống quản trị GEARVN. Cập nhật tiêu đề, nội dung và hình ảnh của bài viết.",
};

export default function Page() {
  return <EditBlogPage />;
}
