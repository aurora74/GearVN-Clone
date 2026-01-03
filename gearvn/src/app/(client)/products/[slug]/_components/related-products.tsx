"use client";

import { useEffect, useRef } from "react";

import Autoplay from "embla-carousel-autoplay";

import { EventType } from "@/types/event";
import { ProductType } from "@/types/product";

import {
  Carousel,
  CarouselItem,
  CarouselContent,
} from "@/components/ui/carousel";

import { ProductCard } from "../../../(home)/_components/product-card";

type RelatedProductsProps = {
  limit?: number;
  events: EventType[];
  products: ProductType[];
};

export const RelatedProducts = ({
  limit,
  events,
  products,
}: RelatedProductsProps) => {
  const autoplay = useRef(Autoplay({ delay: 3000 }));

  useEffect(() => {
    const instance = autoplay.current;
    return () => {
      instance.stop();
    };
  }, []);

  const getBasisClass = (count: number): string => {
    const safeCount = Math.max(count, 2);
    const responsiveMap: Record<number, string> = {
      2: "sm:basis-1/2 md:basis-1/2 lg:basis-1/2",
      3: "sm:basis-1/2 md:basis-1/3 lg:basis-1/3",
      4: "sm:basis-1/2 md:basis-1/3 lg:basis-1/4",
      5: "sm:basis-1/2 md:basis-1/3 lg:basis-1/5",
      6: "sm:basis-1/2 md:basis-1/3 lg:basis-1/6",
    };
    return responsiveMap[safeCount] || responsiveMap[6];
  };

  const isEmpty = products.length === 0;
  const basisClass = getBasisClass(limit ?? 5);

  if (isEmpty) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Không tìm thấy sản phẩm liên quan.
      </p>
    );
  }

  return (
    <Carousel
      plugins={[autoplay.current]}
      opts={{ loop: true, align: "start" }}
    >
      <CarouselContent>
        {products.map((product) => (
          <CarouselItem key={product._id} className={basisClass}>
            <ProductCard product={product} events={events} />
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
};
