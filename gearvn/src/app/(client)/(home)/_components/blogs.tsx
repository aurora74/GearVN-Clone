"use client";

import { useEffect, useRef } from "react";

import Autoplay from "embla-carousel-autoplay";

import { BlogType } from "@/types/blog";

import {
  Carousel,
  CarouselNext,
  CarouselContent,
  CarouselPrevious,
} from "@/components/ui/carousel";

import { BlogCard } from "@/components/global/blogs/blog-card";
import { SectionHeader } from "@/components/global/section-header";

export const Blogs = ({ blogs }: { blogs: BlogType[] }) => {
  const isEmpty = blogs.length === 0;

  const autoplay = useRef(Autoplay({ delay: 3000 }));

  useEffect(() => {
    const instance = autoplay.current;
    return () => {
      instance.stop();
    };
  }, []);

  return (
    <div className="wrapper my-8">
      <div className="pt-6 pb-8 px-5 sm:pb-10 sm:px-10 space-y-8 bg-white shadow-sm rounded-sm">
        <SectionHeader
          href="/blogs"
          linkLabel="Xem tất cả"
          title="Tin tức công nghệ"
          srLabel="Xem tất cả tin tức công nghệ"
        />

        {isEmpty ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Hiện chưa có bài viết nào.
          </p>
        ) : (
          <Carousel
            plugins={[autoplay.current]}
            opts={{ align: "start", loop: true }}
            className="relative"
          >
            <CarouselContent>
              {blogs.map((blog) => (
                <BlogCard key={blog._id} blog={blog} />
              ))}
            </CarouselContent>

            <CarouselPrevious
              aria-label="Bài viết trước"
              className="absolute -left-6 top-1/2 -translate-y-1/2"
            />
            <CarouselNext
              aria-label="Bài viết tiếp theo"
              className="absolute -right-6 top-1/2 -translate-y-1/2"
            />
          </Carousel>
        )}
      </div>
    </div>
  );
};
