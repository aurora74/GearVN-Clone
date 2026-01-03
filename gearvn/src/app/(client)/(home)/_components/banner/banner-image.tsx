import Image from "next/image";

import { cn } from "@/utils/cn";

type BannerImageProps = {
  num: string;
  alt: string;
  priority?: boolean;
  className?: string;
};

export const BannerImage = ({
  num,
  alt,
  className,
  priority = false,
}: BannerImageProps) => (
  <div className={cn("relative", className)}>
    <Image
      fill
      alt={alt}
      priority={priority}
      src={`/banner/illustration-${num}.jpg`}
      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 655px"
      className="object-cover rounded"
    />
  </div>
);
