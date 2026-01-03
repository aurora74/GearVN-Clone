"use client";

import Image from "next/image";
import { useState, useMemo, useEffect, useRef } from "react";

import Autoplay from "embla-carousel-autoplay";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Slideshow from "yet-another-react-lightbox/plugins/slideshow";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";

import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";

import { cn } from "@/utils/cn";

import {
  Carousel,
  CarouselItem,
  CarouselNext,
  CarouselContent,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";

type ProductImageProps = { images: string[] };

export const ProductImage = ({ images }: ProductImageProps) => {
  const [api, setApi] = useState<CarouselApi>();
  const autoplay = useRef(Autoplay({ delay: 3000 }));

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState(-1);

  const slides = useMemo(() => images.map((src) => ({ src })), [images]);

  useEffect(() => {
    const instance = autoplay.current;
    return () => {
      instance.stop();
    };
  }, []);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setSelectedIndex(api.selectedScrollSnap());
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  return (
    <>
      <div className="w-full lg:w-1/2 lg:sticky lg:top-24 sm:h-[500px] flex gap-4">
        <div className="w-[20%] h-full max-h-96 md:max-h-full flex flex-col gap-3 p-2 -m-2 overflow-y-auto custom-scroll">
          {images.map((img, i) => {
            const isActive = selectedIndex === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  api?.scrollTo(i);
                  setSelectedIndex(i);
                }}
                aria-label={`Xem ảnh ${i + 1}`}
                className={cn(
                  "relative w-full flex-shrink-0 aspect-square border-2 hover:border-primary rounded-sm overflow-hidden cursor-pointer",
                  isActive ? "border-primary" : "border-transparent"
                )}
              >
                <Image
                  fill
                  src={img}
                  alt={`Thumbnail ${i + 1}`}
                  className="object-contain"
                />
              </button>
            );
          })}
        </div>

        <div className="relative flex-1 aspect-square cursor-zoom-in">
          <Carousel
            setApi={setApi}
            opts={{ loop: true }}
            plugins={[autoplay.current]}
            className="w-full h-full"
          >
            <CarouselContent>
              {images.map((img, i) => (
                <CarouselItem
                  key={i}
                  onClick={() => setLightboxIndex(i)}
                  className="relative w-full aspect-square"
                >
                  <Image
                    fill
                    src={img}
                    priority={i === 0}
                    alt={`Ảnh sản phẩm ${i + 1}`}
                    className="object-contain"
                  />
                </CarouselItem>
              ))}
            </CarouselContent>

            <CarouselPrevious className="absolute left-2 top-1/2 -translate-y-1/2" />
            <CarouselNext className="absolute right-2 top-1/2 -translate-y-1/2" />
          </Carousel>
        </div>
      </div>

      <Lightbox
        slides={slides}
        index={lightboxIndex}
        open={lightboxIndex >= 0}
        close={() => setLightboxIndex(-1)}
        plugins={[Zoom, Fullscreen, Slideshow, Thumbnails]}
      />
    </>
  );
};
