"use client";

import { useEffect, useRef } from "react";

import Autoplay from "embla-carousel-autoplay";

import { EventType } from "@/types/event";
import { ProductType } from "@/types/product";

import {
  Carousel,
  CarouselItem,
  CarouselNext,
  CarouselContent,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { ProductCard } from "./product-card";
import { SectionHeader } from "@/components/global/section-header";

type BestSellerProps = {
  title: string;
  category: string;
  events: EventType[];
  products: ProductType[];
};

export const BestSeller = ({
  title,
  events,
  category,
  products,
}: BestSellerProps) => {
  const isEmpty = products.length === 0;

  const autoplay = useRef(Autoplay({ delay: 3000 }));

  useEffect(() => {
    const instance = autoplay.current;
    return () => {
      instance.stop();
    };
  }, []);

  return (
    <div className="wrapper my-8">
      <div className="pt-6 pb-8 px-5 sm:pb-10 sm:px-10 space-y-8 bg-white shadow-sm rounded-sm">
        <SectionHeader
          title={title}
          linkLabel="Xem tất cả"
          srLabel="Xem tất cả sản phẩm"
          href={`/collections/${category}`}
        />

        {isEmpty ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Hiện chưa có sản phẩm nào.
          </p>
        ) : (
          <Carousel
            plugins={[autoplay.current]}
            opts={{ align: "start", loop: true }}
            className="relative"
          >
            <CarouselContent>
              {products.map((product) => (
                <CarouselItem
                  key={product._id}
                  aria-label={`Sản phẩm: ${product.name}`}
                  className="basis-1/2 sm:basis-1/3 md:basis-1/4 lg:basis-1/5"
                >
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
