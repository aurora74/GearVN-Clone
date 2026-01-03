import Link from "next/link";
import Image from "next/image";

import { BlogType } from "@/types/blog";
import { formatDateVi } from "@/utils/format/format-date-vi";

import { CarouselItem } from "../../ui/carousel";

export const BlogCard = ({ blog }: { blog: BlogType }) => (
  <CarouselItem
    key={blog._id}
    className="group basis-1/2 sm:basis-1/3 md:basis-1/4"
  >
    <Link
      href={`/blogs/${blog.slug}`}
      aria-label={`Đọc bài viết: ${blog.title}`}
      className="block space-y-2"
    >
      <div className="relative w-full pt-[55%]">
        <Image
          fill
          loading="lazy"
          alt={blog.title}
          src={blog.thumbnail}
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-cover rounded-sm"
        />
      </div>
      <h3
        title={blog.title}
        className="text-sm sm:text-[17px] font-medium group-hover:text-primary leading-snug line-clamp-2"
      >
        {blog.title}
      </h3>
      <p className="text-xs text-muted-foreground">
        {formatDateVi(blog.createdAt)}
      </p>
    </Link>
  </CarouselItem>
);
