import { Metadata } from "next";

import { PageClient } from ".";

export const metadata: Metadata = {
  title: "Hồ sơ của tôi - GEARVN.COM",
  description:
    "Cập nhật thông tin cá nhân, địa chỉ và số điện thoại của bạn tại GEARVN.",
};

export default function Page() {
  return <PageClient />;
}
