import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tạo sản phẩm mới - GEARVN.COM",
  description:
    "Trang tạo sản phẩm mới trong hệ thống quản trị GEARVN. Điền thông tin, hình ảnh và thông số kỹ thuật để thêm sản phẩm vào kho.",
};

const CreateProductLayout = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

export default CreateProductLayout;
