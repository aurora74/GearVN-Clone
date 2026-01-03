"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

import Autoplay from "embla-carousel-autoplay";

import { TOP_ADVERTISES } from "@/constants/advertises";

import {
  Carousel,
  CarouselItem,
  CarouselContent,
} from "@/components/ui/carousel";

export const TopAdvertise = () => {
  const autoplay = useRef(Autoplay({ delay: 3000 }));

  useEffect(() => {
    const instance = autoplay.current;
    return () => {
      instance.stop();
    };
  }, []);

  return (
    <div className="hidden md:block relative">
      <Carousel plugins={[autoplay.current]} aria-label="Banner quảng cáo">
        <CarouselContent>
          {TOP_ADVERTISES.map((banner, idx) => (
            <CarouselItem key={idx} className="pl-0">
              <div className="relative w-full h-[60px]">
                <Image
                  fill
                  sizes="100vw"
                  alt={banner.alt}
                  src={banner.src}
                  priority={idx === 0}
                  className="object-cover"
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  );
};
