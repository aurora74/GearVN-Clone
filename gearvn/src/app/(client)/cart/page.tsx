import { Metadata } from "next";

import { PageClient } from ".";

export const metadata: Metadata = {
  title: "Giỏ hàng của bạn | GEARVN.COM",
  description: "Xem và quản lý các sản phẩm trong giỏ hàng của bạn tại GEARVN.",
  openGraph: {
    title: "Giỏ hàng của bạn | GEARVN.COM",
    description:
      "Xem và quản lý các sản phẩm trong giỏ hàng của bạn tại GEARVN.",
    url: `${process.env.NEXT_PUBLIC_APP_URL}/cart`,
  },
};

export default function Page() {
  return <PageClient />;
}
