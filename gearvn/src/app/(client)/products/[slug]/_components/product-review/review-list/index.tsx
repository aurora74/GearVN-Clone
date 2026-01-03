import { useState } from "react";

import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Slideshow from "yet-another-react-lightbox/plugins/slideshow";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";

import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";

import { ReviewItem } from "./review-item";

import { User } from "@/types/user";
import { ProductType } from "@/types/product";

type ReviewListProps = {
  isPending: boolean;
  isReplying: boolean;
  user?: User | null;
  product: ProductType;
  onToggleLike: (commentId: string) => void;
  onReply: (parentCommentId: string) => void;
};

export const ReviewList = ({
  user,
  product,
  onReply,
  isPending,
  isReplying,
  onToggleLike,
}: ReviewListProps) => {
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<{ src: string }[]>([]);

  const handleOpenZoom = (images: string[], index: number) => {
    setLightboxOpen(true);
    setLightboxIndex(index);
    setLightboxImages(images.map((img) => ({ src: img })));
  };

  return (
    <>
      {product.comments?.map((comment) => (
        <ReviewItem
          key={comment._id}
          user={user}
          product={product}
          comment={comment}
          onReply={onReply}
          isPending={isPending}
          isReplying={isReplying}
          onOpenZoom={handleOpenZoom}
          onToggleLike={onToggleLike}
        />
      ))}

      <Lightbox
        open={lightboxOpen}
        index={lightboxIndex}
        slides={lightboxImages}
        close={() => setLightboxOpen(false)}
        plugins={[Zoom, Slideshow, Fullscreen, Thumbnails]}
      />
    </>
  );
};
