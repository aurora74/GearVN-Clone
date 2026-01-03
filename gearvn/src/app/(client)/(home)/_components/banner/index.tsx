"use client";

import { useEffect, useRef } from "react";

import Autoplay from "embla-carousel-autoplay";

import {
  MAIN_CAROUSEL,
  RIGHT_BANNERS,
  BOTTOM_BANNERS,
} from "@/constants/home/banner";

import {
  Carousel,
  CarouselItem,
  CarouselContent,
} from "@/components/ui/carousel";
import { BannerImage } from "./banner-image";

export const Banner = () => {
  const autoplay = useRef(Autoplay({ delay: 3000 }));

  useEffect(() => {
    const instance = autoplay.current;
    return () => {
      instance.stop();
    };
  }, []);

  return (
    <div className="flex-1 flex gap-3">
      <div className="flex-1 flex flex-col gap-2">
        <Carousel plugins={[autoplay.current]}>
          <CarouselContent>
            {MAIN_CAROUSEL.map((num, idx) => (
              <CarouselItem key={num}>
                <BannerImage
                  num={num}
                  priority={idx === 0}
                  alt={`Banner chính - hình ${idx + 1}`}
                  className="w-full aspect-[2/1]"
                />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        <div className="flex items-center gap-2">
          {BOTTOM_BANNERS.map((num, idx) => (
            <BannerImage
              key={num}
              num={num}
              alt={`Banner dưới - hình ${idx + 1}`}
              className="w-full aspect-[2/1]"
            />
          ))}
        </div>
      </div>

      <div className="w-[350px] 2xl:w-[390px] hidden xl:flex flex-col justify-between">
        {RIGHT_BANNERS.map((num, idx) => (
          <BannerImage
            key={num}
            num={num}
            alt={`Banner bên phải - hình ${idx + 1}`}
            className="w-full aspect-[2/1]"
          />
        ))}
      </div>
    </div>
  );
};
