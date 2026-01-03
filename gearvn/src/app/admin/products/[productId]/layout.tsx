import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chỉnh sửa sản phẩm - GEARVN.COM",
  description:
    "Trang chỉnh sửa sản phẩm trong hệ thống quản trị GEARVN. Cập nhật thông tin, hình ảnh và thông số kỹ thuật của sản phẩm hiện có.",
};

const EditProductLayout = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

export default EditProductLayout;
