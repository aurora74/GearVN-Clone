"use client";

import Autoplay from "embla-carousel-autoplay";

import { BlogType } from "@/types/blog";

import { Carousel, CarouselContent } from "@/components/ui/carousel";

import { BlogCard } from "@/components/global/blogs/blog-card";
import { SectionHeader } from "@/components/global/section-header";

export const RelatedBlogs = ({ blogs }: { blogs: BlogType[] }) => {
  const isEmpty = blogs.length === 0;

  return (
    <div className="wrapper my-8">
      <div className="pt-6 pb-8 px-3 sm:pb-10 sm:px-6 space-y-8 bg-white shadow-sm rounded-sm">
        <SectionHeader
          href="/blogs"
          linkLabel="Xem tất cả"
          title="Bài viết liên quan"
          srLabel="Xem tất cả bài viết"
        />

        {isEmpty ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Hiện chưa có bài viết nào.
          </p>
        ) : (
          <Carousel
            opts={{ align: "start", loop: true }}
            plugins={[Autoplay({ delay: 4000 })]}
          >
            <CarouselContent>
              {blogs.map((blog) => (
                <BlogCard key={blog._id} blog={blog} />
              ))}
            </CarouselContent>
          </Carousel>
        )}
      </div>
    </div>
  );
};
