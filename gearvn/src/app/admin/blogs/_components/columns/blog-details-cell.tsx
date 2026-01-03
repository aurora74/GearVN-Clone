"use client";

import DOMPurify from "isomorphic-dompurify";

import { BlogType } from "@/types/blog";
import { formatDateVi } from "@/utils/format/format-date-vi";

import {
  Sheet,
  SheetTitle,
  SheetHeader,
  SheetTrigger,
  SheetContent,
  SheetDescription,
} from "@/components/ui/sheet";

export const BlogDetailsCell = ({ blog }: { blog: BlogType }) => {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button className="max-w-[200px] font-semibold hover:text-primary hover:underline truncate cursor-pointer">
          {blog.title}
        </button>
      </SheetTrigger>

      <SheetContent className="sm:max-w-lg p-0 gap-0">
        <SheetHeader className="max-w-[480px]">
          <SheetTitle className="text-xl font-bold">{blog.title}</SheetTitle>
          <SheetDescription>
            Ngày tạo: {formatDateVi(blog.createdAt)}
          </SheetDescription>
        </SheetHeader>

        <div className="pb-4 px-4 overflow-y-auto custom-scroll">
          {blog.description && (
            <div
              className="description"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(blog.description, {
                  USE_PROFILES: { html: true },
                  ADD_TAGS: [],
                  ADD_ATTR: [],
                }),
              }}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
