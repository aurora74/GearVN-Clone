import Image from "next/image";
import { useState } from "react";

import { Icon } from "@iconify/react";
import { Loader } from "lucide-react";

import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Slideshow from "yet-another-react-lightbox/plugins/slideshow";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";

import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";

import { User } from "@/types/user";
import { Comment } from "@/types/product";

import { cn } from "@/utils/cn";
import { useProductReviewStore } from "@/stores/use-product-review";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage } from "@/components/ui/avatar";

type ReplyFormProps = {
  comment: Comment;
  user?: User | null;
  isPending: boolean;
  isReplying: boolean;
  onReply: (parentCommentId: string) => void;
};

export const ReplyForm = ({
  user,
  comment,
  onReply,
  isPending,
  isReplying,
}: ReplyFormProps) => {
  const {
    replyTexts,
    replyImages,
    addReplyText,
    addReplyImage,
    removeReplyImage,
    setActiveReplyId,
  } = useProductReviewStore();

  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<{ src: string }[]>([]);

  const openLightbox = (index: number) => {
    setLightboxOpen(true);
    setLightboxIndex(index);
    setLightboxImages(
      (replyImages[comment._id] || []).map((file) =>
        typeof file === "string"
          ? { src: file }
          : { src: URL.createObjectURL(file) }
      )
    );
  };

  return (
    <div className="flex items-start gap-3 mt-3">
      <Avatar className="!size-8">
        <AvatarImage src={user?.avatarUrl || "/avatar-default.jpg"} />
      </Avatar>

      <div className="flex-1 space-y-2">
        <Textarea
          rows={3}
          disabled={isPending}
          placeholder="Nhập phản hồi"
          value={replyTexts[comment._id] || ""}
          onChange={(e) => addReplyText(comment._id, e.target.value)}
        />

        {(replyImages[comment._id] || []).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {(replyImages[comment._id] || []).map((file, index) => (
              <div key={index} className="relative size-24 cursor-zoom-in">
                <Image
                  width={90}
                  height={90}
                  alt={`preview-${index}`}
                  onClick={() => openLightbox(index)}
                  src={
                    typeof file === "string" ? file : URL.createObjectURL(file)
                  }
                  className="rounded object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeReplyImage(comment._id, index)}
                  className={cn(
                    "absolute top-0 right-0 text-white p-1 bg-primary rounded-full cursor-pointer",
                    isPending
                      ? "opacity-50 pointer-events-none"
                      : "hover:bg-primary/80"
                  )}
                >
                  <Icon icon="mdi:close" className="text-white" fontSize={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              multiple
              type="file"
              accept="image/*"
              className="hidden"
              disabled={isPending}
              id={`reply-image-${comment._id}`}
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                addReplyImage(comment._id, files);
                e.target.value = "";
              }}
            />

            <label
              htmlFor={`reply-image-${comment._id}`}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Icon
                fontSize={20}
                icon="mdi:image-plus"
                className="text-primary"
              />
              <span className="hidden sm:block text-sm font-semibold">
                Thêm ảnh mô tả
              </span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              disabled={isPending}
              onClick={() => setActiveReplyId(null)}
            >
              Hủy
            </Button>

            <Button
              onClick={() => onReply(comment._id)}
              disabled={!replyTexts[comment._id]?.trim() || isPending}
            >
              {isReplying && <Loader className="size-4 animate-spin" />}
              Trả lời
            </Button>
          </div>
        </div>

        <Lightbox
          open={lightboxOpen}
          index={lightboxIndex}
          slides={lightboxImages}
          close={() => setLightboxOpen(false)}
          plugins={[Zoom, Slideshow, Fullscreen, Thumbnails]}
        />
      </div>
    </div>
  );
};
