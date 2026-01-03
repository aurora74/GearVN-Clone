import Image from "next/image";
import { useState } from "react";

import { Icon } from "@iconify/react";
import { Edit, Trash } from "lucide-react";

import { User } from "@/types/user";
import { Comment, ProductType } from "@/types/product";

import { cn } from "@/utils/cn";
import { formatTimeFromNow } from "@/utils/format/format-time-from-now";

import { RATING_LABELS } from "@/constants/products/rating-labels";
import { useEditComment } from "@/react-query/mutation/product";
import { useProductReviewStore } from "@/stores/use-product-review";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage } from "@/components/ui/avatar";

import { ReplyForm } from "./reply-form";
import { EditCommentForm } from "./edit-comment";
import { ReplyCommentsList } from "./reply-comments-lists";

import { ModalDeleteComment } from "@/components/modals/comment/delete";

type ReviewItemProps = {
  comment: Comment;
  user?: User | null;
  isPending: boolean;
  isReplying: boolean;
  product: ProductType;
  onToggleLike: (commentId: string) => void;
  onReply: (parentCommentId: string) => void;
  onOpenZoom: (images: string[], index: number) => void;
};

export const ReviewItem = ({
  user,
  product,
  comment,
  onReply,
  isPending,
  isReplying,
  onOpenZoom,
  onToggleLike,
}: ReviewItemProps) => {
  const [editId, setEditId] = useState<string | null>(null);
  const { activeReplyId, setActiveReplyId } = useProductReviewStore();
  const { mutate: editComment, isPending: isEditing } = useEditComment(() =>
    setEditId(null)
  );

  const handleSaveEdit = (content: string, images: (File | string)[]) => {
    editComment({
      productId: product._id,
      commentId: comment._id,
      body: { content, images },
    });
  };

  const commentCreatedAt = comment.createdAt
    ? new Date(comment.createdAt)
    : null;

  const images = comment.images || [];
  const isOwner = user?._id === comment.userId._id;

  return (
    <div className="group flex flex-col sm:flex-row gap-3">
      <div className="w-full sm:w-[40%] md:w-[30%] flex gap-3">
        <Avatar className="!size-9">
          <AvatarImage
            src={comment.userId.avatarUrl || "/avatar-default.jpg"}
          />
        </Avatar>
        <div>
          <p className="text-sm font-medium">{comment.userId.fullName}</p>
          <p className="text-xs text-muted-foreground">
            Đã tham gia {formatTimeFromNow(new Date(comment.userId.createdAt))}
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex">
              {Array.from({ length: 5 }).map((_, idx) => (
                <Icon
                  key={idx}
                  fontSize={25}
                  icon="material-symbols:star-rounded"
                  className={
                    idx < comment.rating ? "text-[#FF8A00]" : "text-gray-300"
                  }
                />
              ))}
            </div>
            <p className="text-sm font-medium">
              {RATING_LABELS[comment.rating - 1]}
            </p>
          </div>

          {isOwner && !editId && (
            <div className="flex gap-2">
              <Button
                size="icon"
                variant="ghost"
                disabled={isPending}
                onClick={() => setEditId(comment._id)}
              >
                <Edit />
              </Button>
              <ModalDeleteComment
                productId={product._id}
                commentId={comment._id}
              >
                <Button size="icon" variant="ghost" disabled={isPending}>
                  <Trash />
                </Button>
              </ModalDeleteComment>
            </div>
          )}
        </div>

        {editId === comment._id ? (
          <EditCommentForm
            isSaving={isEditing}
            initialImages={images}
            onSave={handleSaveEdit}
            commentId={comment._id}
            onCancel={() => setEditId(null)}
            initialContent={comment.content}
          />
        ) : (
          <>
            <p className="text-sm">{comment.content}</p>
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1">
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    onClick={() => onOpenZoom(images, idx)}
                    className="relative size-28 rounded-md overflow-hidden cursor-zoom-in"
                  >
                    <Image
                      fill
                      src={img}
                      alt={`Hình ảnh bình luận ${idx + 1}`}
                      className="object-contain"
                    />
                  </div>
                ))}
              </div>
            )}

            <p className="text-[13px] text-muted-foreground">
              Đánh giá vào{" "}
              {commentCreatedAt && formatTimeFromNow(commentCreatedAt)}
            </p>
          </>
        )}

        {user && !isOwner && (
          <div className="flex items-center gap-4">
            <Button
              size="lg"
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() => onToggleLike(comment._id)}
              className={cn(
                "flex items-center gap-2",
                comment.likes?.includes(user._id) &&
                  "text-primary hover:text-primary bg-primary/10 hover:bg-primary/10"
              )}
            >
              <Icon
                fontSize={20}
                icon="icon-park-outline:like"
                className={cn(
                  comment.likes?.includes(user._id) && "text-primary"
                )}
              />
              {comment.likes?.includes(user._id) ? "Đã thích" : "Thích"}
              {comment.likes?.length > 0 && (
                <span>({comment.likes.length})</span>
              )}
            </Button>

            <Button
              size="lg"
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() =>
                setActiveReplyId(
                  activeReplyId === comment._id ? null : comment._id
                )
              }
              className="flex items-center gap-2"
            >
              <Icon icon="fluent:comment-24-regular" fontSize={20} />
              Trả lời{" "}
              {comment.replies?.length > 0 && `(${comment.replies.length})`}
            </Button>
          </div>
        )}

        <ReplyCommentsList
          productId={product._id}
          currentUserId={user?._id}
          comments={comment.replies}
        />

        {activeReplyId === comment._id && (
          <ReplyForm
            user={user}
            comment={comment}
            onReply={onReply}
            isPending={isPending}
            isReplying={isReplying}
          />
        )}
      </div>
    </div>
  );
};
