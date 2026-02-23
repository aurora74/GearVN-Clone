"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader, Send, X } from "lucide-react";

import { USER_ROLE } from "@/config.global";
import { cn } from "@/utils/cn";
import { useAuthModal } from "@/stores/use-auth-modal";
import { useMe } from "@/react-query/query/user";
import { useProductQuestionsByProduct } from "@/react-query/query/engagement";
import {
  useAddProductQuestionComment,
  useAnswerProductQuestion,
  useCreateProductQuestion,
  useModerateProductQuestion,
  useModerateProductQuestionComment,
} from "@/react-query/mutation/engagement";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

export const ProductQa = ({ productId }: { productId: string }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setModal } = useAuthModal();
  const { data: user } = useMe();
  const { data: questions = [], isPending } =
    useProductQuestionsByProduct(productId);
  const [content, setContent] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [replyText, setReplyText] = useState<Record<string, string>>({});

  const { mutate: createQuestion, isPending: isCreating } =
    useCreateProductQuestion(() => {
      setContent("");
      setImages([]);
    });
  const { mutate: addComment, isPending: isCommenting } =
    useAddProductQuestionComment(() => setReplyText({}));
  const { mutate: answerQuestion, isPending: isAnswering } =
    useAnswerProductQuestion(() => setReplyText({}));
  const { mutate: moderateQuestion, isPending: isModeratingQuestion } =
    useModerateProductQuestion();
  const { mutate: moderateQuestionComment, isPending: isModeratingComment } =
    useModerateProductQuestionComment();

  const isModerator =
    user?.role === USER_ROLE.CSR || user?.role === USER_ROLE.MANAGER;
  const isBusy = isCreating || isCommenting || isAnswering;

  const handleSubmit = () => {
    if (!user) return setModal("login");
    const normalized = content.trim();
    if (!normalized) return;

    createQuestion({ productId, content: normalized, images });
  };

  const handleReply = (questionId: string) => {
    if (!user) return setModal("login");
    const normalized = replyText[questionId]?.trim();
    if (!normalized) return;

    if (isModerator) {
      answerQuestion({ questionId, content: normalized });
      return;
    }

    addComment({ questionId, content: normalized });
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).slice(0, 3);
    setImages(files);
    event.target.value = "";
  };

  return (
    <section className="w-full space-y-6 p-4 sm:p-6 bg-white shadow-sm rounded-sm">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">Hỏi đáp sản phẩm</h2>
        <p className="text-sm text-muted-foreground">
          Câu hỏi công khai về sản phẩm và phản hồi từ Moderator.
        </p>
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
            disabled={isBusy}
            placeholder={
              user
                ? "Nhập câu hỏi về sản phẩm"
                : "Đăng nhập để đặt câu hỏi"
            }
            className="min-h-28 flex-1"
            onChange={(event) => setContent(event.target.value)}
          />
        </div>

        {images.length > 0 && (
          <div className="flex flex-wrap gap-2 pl-12">
            {images.map((file, index) => (
              <Badge
                key={`${file.name}-${index}`}
                variant="secondary"
                className="max-w-full gap-2"
              >
                <span className="max-w-40 truncate">{file.name}</span>
                <button
                  type="button"
                  aria-label="Xóa ảnh"
                  onClick={() =>
                    setImages((current) =>
                      current.filter((_, fileIndex) => fileIndex !== index)
                    )
                  }
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pl-12">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageChange}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isBusy}
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus className="size-4" />
            Thêm ảnh
          </Button>

          {user ? (
            <Button
              type="button"
              disabled={!content.trim() || isBusy}
              onClick={handleSubmit}
            >
              {isCreating ? (
                <Loader className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Gửi câu hỏi
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModal("login")}
            >
              Đăng nhập để đặt câu hỏi
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {isPending ? (
          <div className="space-y-3">
            {[1, 2].map((item) => (
              <div key={item} className="h-24 animate-pulse rounded-sm bg-muted" />
            ))}
          </div>
        ) : questions.length === 0 ? (
          <div className="rounded-sm border border-dashed p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Chưa có câu hỏi nào</p>
            <p>Hãy là người đầu tiên đặt câu hỏi về sản phẩm này.</p>
          </div>
        ) : (
          questions.map((question) => (
            <article
              key={question.id}
              className="space-y-4 border-t pt-4 first:border-t-0 first:pt-0"
            >
              <div className="flex gap-3">
                <Avatar className="size-9">
                  <AvatarFallback>
                    {getInitials(question.author.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">
                      {question.author.displayName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(question.createdAt).toLocaleDateString("vi-VN")}
                    </span>
                    </div>
                    {isModerator && (
                      <ModerationActions
                        disabled={isModeratingQuestion}
                        deleteLabel="Xóa câu hỏi"
                        onModerate={({ action, reason }) =>
                          moderateQuestion({
                            questionId: question.id,
                            action,
                            reason,
                          })
                        }
                      />
                    )}
                  </div>
                  <p className="break-words text-sm leading-6">{question.content}</p>
                  {question.images.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {question.images.map((image) => (
                        <a
                          key={image}
                          href={image}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary underline-offset-4 hover:underline"
                        >
                          Ảnh đính kèm
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {question.comments.length > 0 && (
                <div className="ml-0 space-y-3 border-l pl-4 sm:ml-12">
                  {question.comments.map((comment) => (
                    <div key={comment.id} className="space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={comment.isModerator ? "default" : "secondary"}
                          className={cn(
                            "rounded-sm",
                            comment.isModerator && "bg-primary"
                          )}
                        >
                          {comment.authorRoleLabel}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(comment.createdAt).toLocaleDateString(
                            "vi-VN"
                          )}
                        </span>
                        </div>
                        {isModerator && (
                          <ModerationActions
                            disabled={isModeratingComment}
                            deleteLabel="Xóa bình luận"
                            onModerate={({ action, reason }) =>
                              moderateQuestionComment({
                                questionId: question.id,
                                commentId: comment.id,
                                action,
                                reason,
                              })
                            }
                          />
                        )}
                      </div>
                      <p className="break-words text-sm leading-6">
                        {comment.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {user && (
                <div className="ml-0 flex flex-col gap-2 sm:ml-12">
                  <Textarea
                    rows={2}
                    value={replyText[question.id] || ""}
                    disabled={isBusy}
                    placeholder={
                      isModerator
                        ? "Phản hồi với nhãn Moderator"
                        : "Bổ sung câu hỏi"
                    }
                    onChange={(event) =>
                      setReplyText((current) => ({
                        ...current,
                        [question.id]: event.target.value,
                      }))
                    }
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      disabled={!replyText[question.id]?.trim() || isBusy}
                      onClick={() => handleReply(question.id)}
                    >
                      <Send className="size-4" />
                      Gửi câu hỏi
                    </Button>
                  </div>
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  );
};
