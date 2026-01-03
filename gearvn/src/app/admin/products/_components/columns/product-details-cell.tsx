import Image from "next/image";
import { useState, memo, useMemo } from "react";

import Autoplay from "embla-carousel-autoplay";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Slideshow from "yet-another-react-lightbox/plugins/slideshow";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";

import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";

import { cn } from "@/utils/cn";
import { formatPrice } from "@/utils/format/format-price";
import { ProductType } from "@/types/product";
import { useCategoryByName } from "@/react-query/query/category";

import {
  Sheet,
  SheetTitle,
  SheetHeader,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Carousel,
  CarouselItem,
  CarouselContent,
} from "@/components/ui/carousel";

type ProductDetailsCellProps = { product: ProductType };

export const ProductDetailsCell = memo(
  ({ product }: ProductDetailsCellProps) => {
    const { data: fields } = useCategoryByName(product.category);

    const [activeImage, setActiveImage] = useState(0);
    const [lightboxOpen, setLightboxOpen] = useState(false);

    const openLightbox = (idx: number) => {
      setActiveImage(idx);
      setLightboxOpen(true);
    };

    const slides = useMemo(
      () => product.images?.map((img) => ({ src: img })) ?? [],
      [product.images]
    );

    return (
      <>
        <Sheet>
          <SheetTrigger asChild>
            <button
              aria-label={`Xem chi tiết sản phẩm ${product.name}`}
              className="text-left max-w-[200px] truncate font-semibold hover:text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded cursor-pointer"
            >
              {product.name}
            </button>
          </SheetTrigger>

          <SheetContent className="w-full sm:max-w-5xl p-0">
            <SheetHeader className="pb-0 px-3 sm:px-6 pt-12 sm:pt-6">
              <SheetTitle className="text-xl font-bold">
                {product.name}
              </SheetTitle>
            </SheetHeader>

            <div className="flex flex-col xl:flex-row gap-6 p-3 sm:p-6 h-auto xl:h-[calc(100vh-70px)] overflow-y-auto custom-scroll">
              {/* Bên trái: ảnh + carousel + giá + thuộc tính */}
              <div className="flex flex-col gap-6 xl:w-1/2 xl:flex-1 xl:sticky xl:top-6 xl:overflow-y-auto px-2 -mx-2 custom-scroll">
                {/* Ảnh chính */}
                {product.images?.length > 0 && (
                  <div className="w-full aspect-video relative">
                    <button
                      onClick={() => openLightbox(activeImage)}
                      className="w-full h-full"
                    >
                      <Image
                        fill
                        alt={product.name}
                        src={product.images[activeImage]}
                        className="object-contain cursor-zoom-in"
                      />
                    </button>
                  </div>
                )}

                {/* Thumbnail carousel */}
                {product.images?.length > 1 && (
                  <Carousel
                    className="w-full"
                    plugins={[Autoplay({ delay: 4000 })]}
                  >
                    <CarouselContent className="m-1">
                      {product.images.map((img, idx) => (
                        <CarouselItem key={idx} className="basis-1/5">
                          <button
                            onClick={() => setActiveImage(idx)}
                            className={cn(
                              "relative size-16 rounded overflow-hidden cursor-pointer",
                              activeImage === idx && "ring-2 ring-primary"
                            )}
                          >
                            <Image
                              src={img}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="80px"
                            />
                          </button>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                  </Carousel>
                )}

                {/* Giá + tồn kho */}
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Số lượng:{" "}
                    <span className="text-primary font-semibold">
                      {product.stock ?? "-"}
                    </span>
                  </p>
                  <div className="mt-3 text-lg">
                    {product.discountPrice ? (
                      <div className="space-x-3">
                        <span className="text-primary font-bold text-2xl">
                          {formatPrice(product.discountPrice)}
                        </span>
                        <span className="line-through text-gray-400 text-base">
                          {formatPrice(product.price)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-2xl font-bold">
                        {formatPrice(product.price)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Thuộc tính động */}
                {fields && fields.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2 border mt-4">
                    {fields.map((field) => (
                      <div
                        key={field.name}
                        className="flex justify-between text-sm border-b last:border-none pb-1"
                      >
                        <span className="text-gray-600">{field.label}:</span>
                        <span className="font-medium">
                          {product.attributes?.[field.name] ?? "-"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bên phải: mô tả sản phẩm */}
              <div className="xl:w-1/2 xl:flex-1 xl:overflow-y-auto px-2 -mx-2 mt-6 xl:mt-0 custom-scroll">
                <h4 className="font-semibold mb-2">Mô tả sản phẩm</h4>
                <div
                  className="description"
                  dangerouslySetInnerHTML={{
                    __html: product.description || "<p>Không có mô tả</p>",
                  }}
                />
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Lightbox */}
        {slides.length > 0 && (
          <Lightbox
            open={lightboxOpen}
            index={activeImage}
            close={() => setLightboxOpen(false)}
            controller={{ closeOnBackdropClick: true }}
            plugins={[Zoom, Fullscreen, Slideshow, Thumbnails]}
            thumbnails={{ vignette: true }}
            slides={slides}
          />
        )}
      </>
    );
  }
);

ProductDetailsCell.displayName = "ProductDetailsCell";
