import Link from "next/link";

import { Headset, House, NotepadText, UserRound } from "lucide-react";

export const NavMobile = () => (
  <nav aria-label="Điều hướng trên thiết bị di động">
    <ul className="wrapper h-[55px] fixed bottom-0 left-0 right-0 grid lg:hidden grid-cols-4 gap-6 bg-white z-50">
      <li>
        <Link
          href="/"
          aria-label="Trang chủ"
          className="h-full flex flex-col items-center justify-center"
        >
          <House strokeWidth={1.5} aria-hidden="true" />
          <p className="text-xs">Trang chủ</p>
        </Link>
      </li>

      <li>
        <Link
          href="/"
          aria-label="Danh mục sản phẩm"
          className="h-full flex flex-col items-center justify-center"
        >
          <NotepadText strokeWidth={1.5} aria-hidden="true" />
          <p className="text-xs">Danh mục</p>
        </Link>
      </li>

      <li>
        <Link
          href="/"
          aria-label="Tư vấn hỗ trợ"
          className="h-full flex flex-col items-center justify-center"
        >
          <Headset strokeWidth={1.5} aria-hidden="true" />
          <p className="text-xs">Tư vấn</p>
        </Link>
      </li>

      <li>
        <Link
          href="/settings/my-profile"
          aria-label="Tài khoản người dùng"
          className="h-full flex flex-col items-center justify-center"
        >
          <UserRound strokeWidth={1.5} aria-hidden="true" />
          <p className="text-xs">Tài khoản</p>
        </Link>
      </li>
    </ul>
  </nav>
);
