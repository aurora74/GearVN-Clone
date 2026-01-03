import Link from "next/link";
import Image from "next/image";

import { ImageIcon } from "lucide-react";

import { CategoryType } from "@/types/category";

export const CategoryCard = ({ category }: { category: CategoryType }) => (
  <Link
    href={`/collections/${category.name}`}
    aria-label={`Xem danh mục ${category.label}`}
    className="group flex flex-col items-center gap-2 sm:gap-3"
  >
    <div className="relative w-20 h-20 sm:w-[80px] sm:h-[80px] flex items-center justify-center">
      {category.image ? (
        <Image
          fill
          src={category.image}
          alt={category.label}
          sizes="(max-width: 768px) 64px, 80px"
          className="object-contain"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400 rounded">
          <ImageIcon className="size-6" aria-hidden="true" />
        </div>
      )}
    </div>
    <p className="text-sm sm:text-base font-medium group-hover:text-primary text-center line-clamp-2">
      {category.label}
    </p>
  </Link>
);
