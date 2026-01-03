"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef } from "react";

import Autoplay from "embla-carousel-autoplay";

import { BlogType } from "@/types/blog";
import { formatDateVi } from "@/utils/format/format-date-vi";

import {
  Carousel,
  CarouselItem,
  CarouselContent,
} from "@/components/ui/carousel";

export const Blogs = ({ blogs }: { blogs: BlogType[] }) => {
  const autoplay = useRef(Autoplay({ delay: 3000 }));

  useEffect(() => {
    const instance = autoplay.current;
    return () => {
      instance.stop();
    };
  }, []);

  const isEmpty = blogs.length === 0;

  if (isEmpty) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Hiện chưa có bài viết nào.
      </p>
    );
  }

  return (
    <>
      <div className="hidden sm:flex flex-col space-y-6">
        {blogs.map((blog) => (
          <Link
            key={blog._id}
            href={`/blogs/${blog.slug}`}
            title={`Đọc bài viết: ${blog.title}`}
            aria-label={`Đọc bài viết: ${blog.title}`}
            className="group flex flex-col md:flex-row items-center gap-4"
          >
            <div className="flex-shrink-0 w-full md:w-[300px] lg:w-[150px] xl:w-[250px]">
              <div className="relative w-full aspect-[16/9]">
                <Image
                  fill
                  loading="lazy"
                  alt={blog.title}
                  src={blog.thumbnail}
                  sizes="(max-width: 768px) 100vw, 300px"
                  className="object-cover rounded-sm"
                />
              </div>
            </div>

            <div className="space-y-1 flex-1">
              <h3 className="text-base font-medium group-hover:text-primary line-clamp-2 lg:line-clamp-1 xl:line-clamp-2">
                {blog.title}
              </h3>
              {blog.summary && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {blog.summary}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-4">
                {formatDateVi(new Date(blog.createdAt))}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <div className="sm:hidden">
        <Carousel
          plugins={[autoplay.current]}
          opts={{ loop: true, align: "start" }}
        >
          <CarouselContent className="gap-4">
            {blogs.map((blog) => (
              <CarouselItem
                key={blog._id}
                className="basis-[80%] flex-shrink-0"
              >
                <Link
                  href={`/blogs/${blog.slug}`}
                  title={`Đọc bài viết: ${blog.title}`}
                  aria-label={`Đọc bài viết: ${blog.title}`}
                  className="flex flex-col gap-2 group"
                >
                  <div className="relative w-full aspect-[16/9] rounded-sm overflow-hidden">
                    <Image
                      fill
                      alt={blog.title}
                      src={blog.thumbnail}
                      sizes="100vw"
                      className="object-cover"
                    />
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-sm font-medium group-hover:text-primary line-clamp-2">
                      {blog.title}
                    </h3>
                    {blog.summary && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {blog.summary}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDateVi(new Date(blog.createdAt))}
                    </p>
                  </div>
                </Link>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>
    </>
  );
};
