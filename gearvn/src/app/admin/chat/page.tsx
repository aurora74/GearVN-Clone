import { Metadata } from "next";

import { PageClient } from ".";

export const metadata: Metadata = {
  title: "Trò chuyện với khách hàng - GEARVN.COM",
  description:
    "Quản lý và trao đổi trực tiếp với khách hàng trong hệ thống quản trị GEARVN: xem lịch sử trò chuyện, trạng thái và tin nhắn mới.",
};

export default function Page() {
  return <PageClient />;
}
