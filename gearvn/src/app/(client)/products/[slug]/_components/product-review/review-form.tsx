import Image from "next/image";
import { useRef } from "react";

import { Icon } from "@iconify/react";
import { Loader, Send } from "lucide-react";

import { cn } from "@/utils/cn";
import { User } from "@/types/user";
import { useProductReviewStore } from "@/stores/use-product-review";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage } from "@/components/ui/avatar";

type ReviewFormProps = {
  user?: User | null;
  isPending: boolean;
  isSubmitting: boolean;
  onComment: () => void;
};

export const ReviewForm = ({
  user,
  isPending,
  onComment,
  isSubmitting,
}: ReviewFormProps) => {
  const inputFileRef = useRef<HTMLInputElement>(null);

  const {
    rating,
    images,
    comment,
    setRating,
    setImages,
    setComment,
    removeImage,
  } = useProductReviewStore();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setImages([...images, ...files]);
    e.target.value = "";
  };

  return (
    <>
      <div className="flex items-start gap-4 mt-3">
        <Avatar className="!size-9">
          <AvatarImage src={user?.avatarUrl || "/avatar-default.jpg"} />
        </Avatar>

        <Textarea
          rows={4}
          id="comment"
          value={comment}
          disabled={isPending}
          placeholder="Nhập đánh giá về sản phẩm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onComment();
            }
          }}
          onChange={(e) => setComment(e.target.value)}
          className="flex-1 h-32"
        />
      </div>

      {images.length > 0 && (
        <div className="max-w-full flex gap-2 px-2 mt-2 mb-4 overflow-x-auto custom-scroll">
          {images.map((file, index) => {
            const url = URL.createObjectURL(file);

            return (
              <div key={index} className="relative flex-shrink-0">
                <Image
                  src={url}
                  width={90}
                  height={90}
                  alt={`preview-${index}`}
                  className="object-cover rounded"
                />
                <button
                  type="button"
                  title="Xóa ảnh"
                  disabled={isPending}
                  aria-label="Xóa ảnh"
                  onClick={() => removeImage(index)}
                  className={cn(
                    "absolute top-0 right-0 text-white p-1 bg-primary rounded-full cursor-pointer",
                    isPending
                      ? "opacity-50 pointer-events-none"
                      : "hover:bg-primary/80"
                  )}
                >
                  <Icon icon="mdi:close" fontSize={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div
          className={cn(
            "flex items-center gap-2",
            isPending && "opacity-50 pointer-events-none"
          )}
        >
          <input
            multiple
            type="file"
            accept="image/*"
            className="hidden"
            ref={inputFileRef}
            disabled={isPending}
            onChange={handleImageChange}
          />
          <button
            type="button"
            title="Upload ảnh"
            disabled={isPending}
            aria-label="Upload ảnh"
            onClick={() => inputFileRef.current?.click()}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Icon
              fontSize={25}
              icon="mdi:image-plus"
              className="text-primary"
            />
            <p className="hidden sm:block text-sm font-semibold">
              Thêm ảnh mô tả
            </p>
          </button>
        </div>

        <div className="flex items-center gap-6">
          <div
            role="radiogroup"
            aria-label="Chọn đánh giá sao"
            className={cn(
              "flex items-center",
              isPending && "opacity-50 pointer-events-none"
            )}
          >
            {[1, 2, 3, 4, 5].map((star) => (
              <Icon
                key={star}
                role="radio"
                tabIndex={0}
                fontSize={25}
                aria-checked={star === rating}
                onClick={() => setRating(star)}
                aria-label={`Chọn ${star} sao`}
                icon="material-symbols:star-rounded"
                className={cn(
                  "cursor-pointer",
                  star <= rating ? "text-[#FF8A00]" : "text-gray-300"
                )}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setRating(star);
                }}
              />
            ))}
          </div>

          <Button
            type="submit"
            onClick={onComment}
            disabled={!comment.trim() || isPending}
          >
            {isSubmitting ? (
              <Loader className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Đánh giá
          </Button>
        </div>
      </div>
    </>
  );
};
