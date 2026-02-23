"use client";

import { useState } from "react";
import { Loader, Send } from "lucide-react";
import { USER_ROLE } from "@/config.global";

import { useAuthModal } from "@/stores/use-auth-modal";
import { useMe } from "@/react-query/query/user";
import { useBlogComments } from "@/react-query/query/blog";
import {
  useCreateBlogComment,
  useModerateBlogComment,
} from "@/react-query/mutation/blog";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ModerationActions } from "@/components/moderation/moderation-actions";

const getInitials = (name?: string) =>
  name
    ?.split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

export const BlogComments = ({ blogId }: { blogId: string }) => {
  const { setModal } = useAuthModal();
  const { data: user } = useMe();
  const { data: comments = [], isPending } = useBlogComments(blogId);
  const [content, setContent] = useState("");

  const { mutate: createComment, isPending: isCreating } =
    useCreateBlogComment(() => setContent(""));
  const { mutate: moderateBlogComment, isPending: isModerating } =
    useModerateBlogComment();
  const isModerator =
    user?.role === USER_ROLE.CSR || user?.role === USER_ROLE.MANAGER;

  const handleSubmit = () => {
    if (!user) return setModal("login");

    const normalized = content.trim();
    if (!normalized) return;

    createComment({ blogId, content: normalized });
  };

  return (
    <section className="bg-white px-2 py-6 shadow-sm sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[900px] space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Bình luận</h2>
          <span className="text-sm text-muted-foreground">
            {comments.length} bình luận
          </span>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Avatar className="size-9">
              <AvatarImage src={user?.avatarUrl || "/avatar-default.jpg"} />
              <AvatarFallback>{getInitials(user?.fullName)}</AvatarFallback>
            </Avatar>
            <Textarea
              rows={4}
              value={content}
              disabled={isCreating}
              placeholder={
                user ? "Chia sẻ cảm nghĩ của bạn" : "Đăng nhập để bình luận"
              }
              className="min-h-24 flex-1"
              onChange={(event) => setContent(event.target.value)}
            />
          </div>

          <div className="flex justify-end">
            {user ? (
              <Button
                type="button"
                disabled={!content.trim() || isCreating}
                onClick={handleSubmit}
              >
                {isCreating ? (
                  <Loader className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Đăng bình luận
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setModal("login")}
              >
                Đăng nhập để bình luận
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {isPending ? (
            <div className="space-y-3">
              {[1, 2].map((item) => (
                <div key={item} className="h-20 animate-pulse rounded-sm bg-muted" />
              ))}
            </div>
          ) : comments.length === 0 ? (
            <div className="rounded-sm border border-dashed p-4 text-sm text-muted-foreground">
              Chưa có bình luận nào
            </div>
          ) : (
            comments.map((comment) => (
              <article
                key={comment.id}
                className="flex gap-3 border-t pt-4 first:border-t-0 first:pt-0"
              >
                <Avatar className="size-9">
                  <AvatarImage src={comment.author.avatarUrl} />
                  <AvatarFallback>
                    {getInitials(comment.author.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">
                      {comment.author.displayName}
                    </span>
                    <time className="text-xs text-muted-foreground">
                      {new Date(comment.createdAt).toLocaleString("vi-VN", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </time>
                    </div>
                    {isModerator && (
                      <ModerationActions
                        disabled={isModerating}
                        deleteLabel="Xóa bình luận"
                        onModerate={({ action, reason }) =>
                          moderateBlogComment({
                            blogId,
                            commentId: comment.id,
                            action,
                            reason,
                          })
                        }
                      />
                    )}
                  </div>
                  <p className="break-words text-sm leading-6">{comment.content}</p>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
};
