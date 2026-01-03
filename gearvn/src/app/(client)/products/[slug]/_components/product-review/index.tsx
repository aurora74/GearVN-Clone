"use client";

import {
  useComment,
  useReplyComment,
  useToggleLikeComment,
} from "@/react-query/mutation/product";
import { useMe } from "@/react-query/query/user";
import { useProduct } from "@/react-query/query/product";

import { useAuthModal } from "@/stores/use-auth-modal";
import { useProductReviewStore } from "@/stores/use-product-review";

import { ReviewList } from "./review-list";
import { ReviewForm } from "./review-form";
import { ReviewHeader } from "./review-header";
import { ProductReviewSkeleton } from "./product-review-skeleton";

export const ProductReview = ({ productId }: { productId: string }) => {
  const { setModal } = useAuthModal();

  const { data: user } = useMe();
  const { data: product } = useProduct(productId);

  const {
    images,
    rating,
    comment,
    replyTexts,
    replyImages,
    resetReplyForm,
    resetCommentForm,
  } = useProductReviewStore();

  const { mutate: replyComment, isPending: isReplying } =
    useReplyComment(resetReplyForm);

  const { mutate: toggleLikeComment, isPending: isLiking } =
    useToggleLikeComment();

  const { mutate: submitComment, isPending: isSubmitting } = useComment(
    productId,
    resetCommentForm
  );

  const handleToggleLike = (commentId: string) => {
    if (!user) return setModal("login");
    toggleLikeComment({ productId, commentId });
  };

  const handleReply = (parentCommentId: string) => {
    if (!user) return setModal("login");

    const text = replyTexts[parentCommentId]?.trim();
    if (!text) return;

    replyComment({
      productId,
      parentCommentId,
      body: { content: text, images: replyImages[parentCommentId] || [] },
    });
  };

  const handleSubmitComment = () => {
    if (!user) return setModal("login");
    if (!comment.trim()) return;
    submitComment({ content: comment.trim(), rating, images });
  };

  if (!product) return <ProductReviewSkeleton />;

  return (
    <div className="w-full space-y-6 p-6 bg-white shadow-md rounded-sm">
      <ReviewHeader product={product} />

      <ReviewList
        user={user}
        product={product}
        onReply={handleReply}
        isReplying={isReplying}
        onToggleLike={handleToggleLike}
        isPending={isSubmitting || isLiking || isReplying}
      />

      <ReviewForm
        user={user}
        isSubmitting={isSubmitting}
        onComment={handleSubmitComment}
        isPending={isSubmitting || isLiking || isReplying}
      />
    </div>
  );
};
