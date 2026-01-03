import Image from "next/image";
import { useState, ChangeEvent } from "react";

import { X, Edit, Loader, Trash, Link as LinkIcon } from "lucide-react";

import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Slideshow from "yet-another-react-lightbox/plugins/slideshow";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";

import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";

import { cn } from "@/utils/cn";
import { formatTimeFromNow } from "@/utils/format/format-time-from-now";

import { Comment } from "@/types/product";
import { useEditComment } from "@/react-query/mutation/product";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { ModalDeleteComment } from "@/components/modals/comment/delete";

type ReplyCommentsListProps = {
  productId: string;
  comments: Comment[];
  currentUserId?: string;
};

export const ReplyCommentsList = ({
  comments,
  productId,
  currentUserId,
}: ReplyCommentsListProps) => {
  const [editContent, setEditContent] = useState("");
  const [editReplyId, setEditReplyId] = useState<string | null>(null);

  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const [editImages, setEditImages] = useState<(File | string)[]>([]);
  const [lightboxImages, setLightboxImages] = useState<{ src: string }[]>([]);

  const { mutate: editComment, isPending: isEditingComment } = useEditComment(
    () => {
      setEditImages([]);
      setEditContent("");
      setEditReplyId(null);
    }
  );

  const handleEditClick = (reply: Comment) => {
    setEditReplyId(reply._id);
    setEditContent(reply.content);
    setEditImages(reply.images || []);
  };

  const handleSaveEdit = (replyId: string) => {
    if (!editContent.trim()) return;
    editComment({
      productId,
      commentId: replyId,
      body: { content: editContent, images: editImages },
    });
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setEditImages((prev) => [...prev, ...Array.from(files)]);
    e.target.value = "";
  };

  const handleOpenZoom = (images: (string | File)[], index: number) => {
    const urls = images
      .filter((i): i is string => typeof i === "string")
      .map((i) => ({ src: i }));

    setLightboxOpen(true);
    setLightboxImages(urls);
    setLightboxIndex(index);
  };

  return (
    <div className="flex flex-col space-y-4">
      {comments.map((reply) => {
        const images = reply.images || [];

        const replyCreatedAt = reply.createdAt
          ? new Date(reply.createdAt)
          : null;

        const isEditing = editReplyId === reply._id;
        const canEdit = currentUserId === reply.userId._id;

        return (
          <div key={reply._id} className="group flex gap-3">
            <Avatar className="!size-8">
              <AvatarImage
                src={reply.userId.avatarUrl || "/avatar-default.jpg"}
              />
            </Avatar>

            <div className="flex-1">
              <div className="relative flex items-center gap-2">
                <p className="text-sm font-medium">{reply.userId.fullName}</p>
                <span className="text-xs text-muted-foreground">
                  {replyCreatedAt && formatTimeFromNow(replyCreatedAt)}
                </span>

                {canEdit && !isEditing && (
                  <div className="absolute top-0 right-0 flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleEditClick(reply)}
                    >
                      <Edit />
                    </Button>

                    <ModalDeleteComment
                      productId={productId}
                      commentId={reply._id}
                    >
                      <Button size="icon" variant="ghost">
                        <Trash />
                      </Button>
                    </ModalDeleteComment>
                  </div>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-2 mt-2">
                  <div className="flex items-start gap-2">
                    <label
                      htmlFor={`edit-reply-file-${reply._id}`}
                      className={cn(
                        "text-gray-500 hover:text-gray-700 mt-2 cursor-pointer",
                        isEditingComment && "cursor-not-allowed opacity-50"
                      )}
                    >
                      <LinkIcon size={18} />
                    </label>

                    <Textarea
                      value={editContent}
                      disabled={isEditingComment}
                      placeholder="Chỉnh sửa nội dung..."
                      onChange={(e) => setEditContent(e.target.value)}
                      className="flex-1"
                    />
                  </div>

                  <input
                    multiple
                    type="file"
                    accept="image/*"
                    id={`edit-reply-file-${reply._id}`}
                    onChange={handleImageChange}
                    className="hidden"
                  />

                  {editImages.length > 0 && (
                    <div className="flex gap-2 flex-wrap mt-2">
                      {editImages.map((img, idx) => (
                        <div key={idx} className="relative size-24">
                          <Image
                            fill
                            src={
                              typeof img === "string"
                                ? img
                                : URL.createObjectURL(img)
                            }
                            alt={typeof img === "string" ? "Ảnh" : img.name}
                            className="object-contain"
                          />
                          <button
                            type="button"
                            disabled={isEditingComment}
                            className="absolute top-1 right-1 text-white p-1 bg-black/50 rounded-full"
                            onClick={() =>
                              setEditImages((prev) =>
                                prev.filter((_, i) => i !== idx)
                              )
                            }
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 mt-2">
                    <Button
                      disabled={isEditingComment}
                      onClick={() => handleSaveEdit(reply._id)}
                    >
                      {isEditingComment && (
                        <Loader className="animate-spin size-4" />
                      )}
                      Lưu
                    </Button>

                    <Button
                      variant="outline"
                      disabled={isEditingComment}
                      onClick={() => setEditReplyId(null)}
                    >
                      Hủy
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm mt-1">{reply.content}</p>
                  {images.length > 0 && (
                    <div className="flex gap-2 flex-wrap mt-2">
                      {images.map((imgUrl, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleOpenZoom(images, idx)}
                          className="relative size-24 cursor-zoom-in rounded overflow-hidden"
                        >
                          <Image
                            fill
                            src={
                              typeof imgUrl === "string"
                                ? imgUrl
                                : URL.createObjectURL(imgUrl)
                            }
                            alt={`reply-img-${idx}`}
                            className="object-contain"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}

      <Lightbox
        open={lightboxOpen}
        index={lightboxIndex}
        slides={lightboxImages}
        close={() => setLightboxOpen(false)}
        plugins={[Zoom, Slideshow, Fullscreen, Thumbnails]}
      />
    </div>
  );
};
