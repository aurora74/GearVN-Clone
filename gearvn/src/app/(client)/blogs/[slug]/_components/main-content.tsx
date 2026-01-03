"use client";

import DOMPurify from "isomorphic-dompurify";
import { Clock, LinkIcon, Share2 } from "lucide-react";

import { BlogType } from "@/types/blog";
import { formatDateVi } from "@/utils/format/format-date-vi";

import { Button } from "@/components/ui/button";
import { toastError, toastSuccess } from "@/components/ui/toaster";

export const MainContent = ({ blog }: { blog: BlogType }) => {
  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    toastSuccess("Đã sao chép link", "Bạn có thể dán ở bất kỳ đâu.");
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: blog.title,
        text: blog.summary,
        url: window.location.href,
      });
    } else {
      toastError("Trình duyệt không hỗ trợ chia sẻ");
    }
  };

  return (
    <article
      itemScope
      itemType="https://schema.org/BlogPosting"
      className="py-8 px-2 lg:p-8 bg-white shadow-sm rounded-sm"
    >
      <div className="max-w-[900px] mx-auto">
        <header className="space-y-4">
          <h1 itemProp="headline" className="text-3xl font-bold leading-tight">
            {blog.title}
          </h1>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="size-4" />
              <time
                itemProp="datePublished"
                dateTime={new Date(blog.createdAt).toISOString()}
              >
                {formatDateVi(blog.createdAt)}
              </time>
            </div>

            <div className="flex gap-1 sm:gap-2">
              <Button
                size="icon"
                variant="ghost"
                aria-label="Copy link"
                onClick={handleCopyLink}
              >
                <LinkIcon className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Share"
                onClick={handleShare}
              >
                <Share2 className="size-4" />
              </Button>
            </div>
          </div>
        </header>

        <section
          itemProp="articleBody"
          className="description"
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(blog.description, {
              USE_PROFILES: { html: true },
              ADD_TAGS: [],
              ADD_ATTR: [],
            }),
          }}
        />
      </div>
    </article>
  );
};
