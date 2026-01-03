"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";

import {
  MapPin,
  Loader,
  Headset,
  UserRound,
  ClipboardClock,
} from "lucide-react";

import { USER_ROLE } from "@/config.global";
import { CategoryType } from "@/types/category";
import { useMe } from "@/react-query/query/user";
import { useAuthModal } from "@/stores/use-auth-modal";

import { UserSettings } from "./user-settings";
import { CartDropdown } from "./cart-dropdown";
import { SearchProducts } from "./search-products";
import { CategoriesMenu } from "./categories-menu";

import { Button } from "@/components/ui/button";

export const Header = ({ categories }: { categories: CategoryType[] }) => {
  const { setModal } = useAuthModal();
  const { data: user, isPending } = useMe();

  return (
    <header role="banner" className="bg-primary sticky top-0 z-50">
      <div className="wrapper h-[70px] flex items-center justify-between gap-4 sm:gap-6 xl:gap-8">
        <CategoriesMenu categories={categories} />

        <Link
          href="/"
          title="Trang chủ"
          className="hidden lg:block flex-shrink-0"
        >
          <Image
            priority
            width={160}
            height={160}
            src="/logo-text.svg"
            alt="Trang chủ - Logo thương hiệu"
          />
        </Link>

        <Link
          href="/"
          title="Trang chủ"
          className="block lg:hidden flex-shrink-0"
        >
          <Image
            priority
            width={40}
            height={40}
            src="/logo.svg"
            alt="Trang chủ - Logo thương hiệu"
          />
        </Link>

        <Suspense>
          <SearchProducts />
        </Suspense>

        <section
          aria-label="Hotline hỗ trợ"
          className="hidden lg:block flex-shrink-0 text-primary-foreground"
        >
          <Link href="tel:19005301" className="group flex items-center gap-2">
            <Headset aria-hidden="true" className="flex-shrink-0" />
            <p className="sr-only">Hotline hỗ trợ khách hàng</p>
            <p className="hidden xl:block text-sm font-semibold whitespace-nowrap">
              Hotline: <br />
              <span className="group-hover:underline">1900 5301</span>
            </p>
          </Link>
        </section>

        <section
          aria-label="Hệ thống Showroom"
          className="hidden lg:block flex-shrink-0 text-primary-foreground"
        >
          <Link
            href="/showrooms"
            title="Xem hệ thống showroom"
            className="flex items-center gap-2"
          >
            <MapPin aria-hidden="true" className="flex-shrink-0" />
            <p className="sr-only">Xem hệ thống Showroom</p>
            <p className="hidden xl:block text-sm font-semibold">
              Hệ thống <br /> Showroom
            </p>
          </Link>
        </section>

        {user?.role === USER_ROLE.CUSTOMER && (
          <>
            <section
              aria-label="Tra cứu đơn hàng"
              className="hidden lg:block flex-shrink-0 text-primary-foreground"
            >
              <Link
                href="/orders/lookup"
                title="Tra cứu đơn hàng"
                className="flex items-center gap-2"
              >
                <ClipboardClock aria-hidden="true" className="flex-shrink-0" />
                <p className="sr-only">Tra cứu đơn hàng của bạn</p>
                <p className="hidden xl:block text-sm font-semibold">
                  Tra cứu <br /> đơn hàng
                </p>
              </Link>
            </section>

            <CartDropdown />
          </>
        )}

        {isPending ? (
          <Loader className="flex-shrink-0 size-5 animate-spin text-white" />
        ) : user ? (
          <UserSettings user={user} />
        ) : (
          <Button
            type="button"
            aria-label="Đăng nhập tài khoản"
            onClick={() => setModal("login")}
            className="h-10 flex items-center gap-2 font-semibold bg-[#BE1529] hover:bg-[#BE1529] rounded-sm"
          >
            <UserRound className="size-5" aria-hidden="true" />
            <p className="hidden xl:block">Đăng nhập</p>
          </Button>
        )}
      </div>
    </header>
  );
};
