import Link from "next/link";
import Image from "next/image";

import { Calendar, Clock } from "lucide-react";

import { BlogType } from "@/types/blog";
import { formatDateVi } from "@/utils/format/format-date-vi";

export const BlogGrid = ({ blogs }: { blogs: BlogType[] }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {blogs.map((blog) => (
        <Link
          key={blog._id}
          title={blog.title}
          href={`/blogs/${blog.slug}`}
          aria-label={`Xem chi tiết bài viết: ${blog.title}`}
          className="block group"
        >
          <article className="border bg-card rounded-md shadow-sm hover:shadow-md overflow-hidden">
            <div className="relative overflow-hidden">
              <div className="relative w-full h-56">
                <Image
                  fill
                  loading="lazy"
                  alt={blog.title}
                  src={blog.thumbnail}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100" />
              </div>

              <div className="absolute top-4 right-4 flex items-center gap-1.5 text-xs font-medium py-1 px-3 bg-card/90 backdrop-blur-sm rounded-full">
                <Clock className="size-3" /> 5 phút đọc
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-3">
                <h2 className="min-h-[3.5rem] text-xl font-bold group-hover:text-primary line-clamp-2">
                  {blog.title}
                </h2>
                <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                  {blog.summary}
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Calendar className="size-4" />
                  {formatDateVi(blog.createdAt)}
                </div>
                <span className="text-sm font-medium text-primary group-hover:underline">
                  Đọc thêm
                </span>
              </div>
            </div>
          </article>
        </Link>
      ))}
    </div>
  );
};
