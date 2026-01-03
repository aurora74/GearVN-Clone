import { Metadata } from "next";

import { MyOrdersPage } from "./_components";

export const metadata: Metadata = {
  title: "Đơn hàng của tôi | GEARVN",
  description:
    "Xem lịch sử đơn hàng, trạng thái vận chuyển và chi tiết thanh toán tại GEARVN.",
};

export default function Page() {
  return <MyOrdersPage />;
}
