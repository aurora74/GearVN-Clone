"use client";

import Link from "next/link";

import { ChevronRight } from "lucide-react";

import { EventType } from "@/types/event";
import { ProductType } from "@/types/product";

import { EventHeader } from "./event-header";
import { EventCarousel } from "./event-carousel";

type EventProps = {
  tag: string;
  title: string;
  event: EventType;
  events: EventType[];
  isShortList?: boolean;
  products: ProductType[] | null;
};

export const Event = ({
  tag,
  title,
  event,
  events,
  products,
  isShortList = false,
}: EventProps) => {
  const hasProducts = products && products.length > 0;

  return (
    <section className="wrapper mt-8">
      <div className="pt-6 pb-6 px-5 sm:px-10 space-y-8 bg-[url('/art-board.png')] shadow-md rounded-sm">
        <EventHeader title={title} />

        {hasProducts ? (
          <EventCarousel
            event={event}
            events={events}
            products={products}
            isShortList={isShortList}
          />
        ) : (
          <p className="text-sm text-white py-6 text-center">
            Hiện chưa có sản phẩm nào.
          </p>
        )}

        <Link
          href={`/events/${tag}`}
          aria-label={`Xem tất cả sản phẩm trong sự kiện ${title}`}
          className="flex sm:hidden items-center justify-center gap-2 text-[15px] font-medium text-white hover:underline"
        >
          Xem tất cả
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </section>
  );
};
