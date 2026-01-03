"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

import Autoplay from "embla-carousel-autoplay";

import { cn } from "@/utils/cn";

import { EventType } from "@/types/event";
import { ProductType } from "@/types/product";

import {
  Carousel,
  CarouselItem,
  CarouselNext,
  CarouselContent,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { ProductCard } from "../product-card";

type EventCarouselProps = {
  event: EventType;
  events: EventType[];
  isShortList?: boolean;
  products: ProductType[];
};

export const EventCarousel = ({
  event,
  events,
  products,
  isShortList = false,
}: EventCarouselProps) => {
  const autoplay = useRef(Autoplay({ delay: 3000 }));

  const isEmpty = products.length === 0;

  useEffect(() => {
    const instance = autoplay.current;
    return () => {
      instance.stop();
    };
  }, []);

  const getItemBasis = (event: EventType, isShortList: boolean) => {
    if (isShortList || event.image) {
      return "basis-1/2 md:basis-1/3 lg:basis-1/4";
    }
    return "basis-1/2 sm:basis-1/3 md:basis-1/4 lg:basis-1/5";
  };

  const itemBasis = getItemBasis(event, isShortList);

  return (
    <div className="flex flex-wrap items-center gap-12">
      {event.image && (
        <Image
          width={400}
          height={400}
          alt={event.name}
          src={event.image}
          sizes="(max-width: 768px) 200px, (max-width: 1200px) 300px, 400px"
          className="hidden sm:block flex-shrink-0 w-full max-w-[200px] sm:max-w-[300px] lg:max-w-[400px] h-auto rounded-md"
        />
      )}

      <div className="flex-1 min-w-0">
        {isEmpty ? (
          <p className="text-sm text-muted-foreground">
            Chưa có sản phẩm cho sự kiện này.
          </p>
        ) : (
          <Carousel
            plugins={[autoplay.current]}
            opts={{ align: "start", loop: true }}
            className="relative"
          >
            <CarouselContent>
              {products.map((product) => (
                <CarouselItem key={product._id} className={cn(itemBasis)}>
                  <ProductCard events={events} product={product} />
                </CarouselItem>
              ))}
            </CarouselContent>

            <CarouselPrevious
              aria-label="Sản phẩm trước"
              className="absolute -left-6 top-1/2 -translate-y-1/2"
            />
            <CarouselNext
              aria-label="Sản phẩm tiếp theo"
              className="absolute -right-6 top-1/2 -translate-y-1/2"
            />
          </Carousel>
        )}
      </div>
    </div>
  );
};
