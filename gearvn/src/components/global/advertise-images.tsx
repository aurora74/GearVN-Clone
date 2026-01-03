"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import {
  AD_BANNERS_ROW,
  AD_BANNERS_GRID,
  AUTO_BANNER_IMAGES,
} from "@/constants/advertises";

type Props = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
  className?: string;
};

const BannerImage = ({
  src,
  alt,
  className,
  width = 1000,
  height = 1000,
  priority = false,
}: Props) => (
  <Image
    src={src}
    alt={alt}
    width={width}
    height={height}
    priority={priority}
    className={className}
  />
);

export const AdImageRow = () => (
  <div className="wrapper flex flex-col md:flex-row items-center gap-3 my-8">
    {AD_BANNERS_ROW.map((banner, idx) => (
      <div className="flex-1" key={idx}>
        <BannerImage {...banner} />
      </div>
    ))}
  </div>
);

export const AdImageGrid = () => (
  <div className="wrapper flex flex-col md:flex-row gap-3 my-8">
    <div className="w-full md:w-2/3">
      <BannerImage {...AD_BANNERS_GRID[0]} priority className="rounded-sm" />
    </div>

    <div className="flex-1 flex flex-col gap-3">
      {AD_BANNERS_GRID.slice(1).map((banner, idx) => (
        <BannerImage key={idx} {...banner} className="rounded-sm" />
      ))}
    </div>
  </div>
);

export const AutoBanner = () => {
  const [index, setIndex] = useState(0);

  const { src, alt } = AUTO_BANNER_IMAGES[index];

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % AUTO_BANNER_IMAGES.length);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full pt-[25%]">
      <Image
        fill
        src={src}
        alt={alt}
        priority={index === 0}
        className="object-cover rounded-sm transition-opacity duration-500"
      />
    </div>
  );
};
