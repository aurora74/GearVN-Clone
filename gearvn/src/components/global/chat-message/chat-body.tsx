import {
  useRef,
  Dispatch,
  useState,
  RefObject,
  useEffect,
  SetStateAction,
} from "react";
import Image from "next/image";

import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Slideshow from "yet-another-react-lightbox/plugins/slideshow";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";

import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";

import { ArrowUp, Edit, Loader2, MoreVertical, Trash } from "lucide-react";

import { User } from "@/types/user";
import {
  AssistantActionDraft,
  AssistantCheckoutReviewCard,
  AssistantProductCard,
  Message,
} from "@/types/chat";

import { cn } from "@/utils/cn";
import { formatDateVi } from "@/utils/format/format-date-vi";
import { formatShortName } from "@/utils/format/format-short-name";
import { formatDateTimeVi } from "@/utils/format/format-date-time-vi";

import { USER_ROLE } from "@/config.global";
import { useMessagesByRoom } from "@/react-query/query/chat";
import { DEFAULT_MESSAGE_CHAT } from "@/constants/chat/default-message-chat";

import { MessageSkeleton } from "./message-skeleton";
import { AiActionButton } from "./ai-action-button";
import { AiOrderCard } from "./ai-order-card";
import { AiProductCard } from "./ai-product-card";
import { AiReviewSummary } from "./ai-review-summary";

import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type ChatBodyProps = {
  roomId: string;
  user: User | null;
  isTyping: boolean;
  isAssistantThinking: boolean;
  messages: Message[];
  socketRef: RefObject<any>;
  setMessages: Dispatch<SetStateAction<Message[]>>;
  setUnreadCount: Dispatch<SetStateAction<number>>;
  onConfirmAssistantAction?: (draft: AssistantActionDraft) => void;
  pendingAssistantDraftId?: string | null;
  onPendingAssistantDraftChange?: (draftId: string | null) => void;
  onOptimisticAssistantMessage?: (message: {
    text: string;
    attachments: string[];
    createdAt: string;
  }) => void;
  onAssistantRequestStart?: () => void;
};

const formatUnsupportedReason = (reason: unknown) => {
  if (reason === "out_of_scope") return "Ngoài phạm vi hỗ trợ hiện tại";
  if (reason === "direct_order_or_payment_creation") {
    return "Cần xác nhận qua hệ thống GearVN";
  }
  return typeof reason === "string" ? reason : "Yêu cầu chưa được hỗ trợ";
};

const getMessageActionDrafts = (message: Message) => {
  if (message.isDeleted || message.metadata?.kind !== "assistant") return [];

  const drafts = message.metadata.actionDrafts ?? [];
  const singleDraft = message.metadata.actionDraft;
  const allDrafts = singleDraft ? [...drafts, singleDraft] : drafts;
  const seen = new Set<string>();

  return allDrafts.filter((draft) => {
    if (!draft?.draftId || seen.has(draft.draftId)) return false;
    seen.add(draft.draftId);
    return true;
  });
};

const uniqueProductCards = (cards: AssistantProductCard[]) => {
  const seen = new Set<string>();
  return cards.filter((card) => {
    if (!card?.productId || seen.has(card.productId)) return false;
    seen.add(card.productId);
    return true;
  });
};

const hasInteractiveAssistantMetadata = (message: Message) =>
  getMessageActionDrafts(message).length > 0 ||
  Boolean(
    !message.isDeleted &&
      message.metadata?.kind === "assistant" &&
      message.metadata.checkoutReview,
  );
type AiCheckoutReviewCardProps = {
  review: AssistantCheckoutReviewCard;
  draft?: AssistantActionDraft | null;
  roomId: string;
  userId?: string;
  socketRef: RefObject<any>;
  pendingDraftId?: string | null;
  onConfirmAction?: (draft: AssistantActionDraft) => void;
  onOptimisticMessage?: (message: {
    text: string;
    attachments: string[];
    createdAt: string;
  }) => void;
  onAssistantRequestStart?: () => void;
};

const AiCheckoutReviewCard = ({
  review,
  draft,
  roomId,
  userId,
  socketRef,
  pendingDraftId,
  onConfirmAction,
  onOptimisticMessage,
  onAssistantRequestStart,
}: AiCheckoutReviewCardProps) => {
  const isPending = Boolean(draft?.draftId && pendingDraftId === draft.draftId);
  const sendReviewReply = (text: string) => {
    if (!socketRef.current || !roomId) return;
    const createdAt = new Date().toISOString();
    socketRef.current.emit("send-message", {
      text,
      roomId,
      isRead: false,
      userId,
      sender: "CUSTOMER",
      createdAt,
      attachments: [],
    });
    onOptimisticMessage?.({ text, attachments: [], createdAt });
    onAssistantRequestStart?.();
  };
  const confirmReview = () => {
    if (draft) {
      onConfirmAction?.(draft);
      return;
    }
    sendReviewReply("Đúng rồi");
  };

  return (
    <div className="w-full rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-gray-900">
      <div className="space-y-2">
        <div className="flex justify-between gap-3">
          <span className="shrink-0 text-gray-500">Tên</span>
          <span className="min-w-0 text-right font-medium">
            {review.name || "Chưa có"}
          </span>
        </div>
        <div className="flex justify-between gap-3" aria-label="phone">
          <span className="shrink-0 text-gray-500">Số điện thoại</span>
          <span className="min-w-0 text-right font-medium">
            {review.phoneMasked || review.phone || "Chưa có"}
          </span>
        </div>
        <div className="flex justify-between gap-3" aria-label="address">
          <span className="shrink-0 text-gray-500">Địa chỉ</span>
          <span className="min-w-0 text-right font-medium">
            {review.addressPreview || review.address || "Chưa có"}
          </span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={confirmReview}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md bg-primary px-3 text-xs font-semibold text-white transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-wait disabled:opacity-70"
        >
          Đúng rồi
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => sendReviewReply("Chỉnh sửa")}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-70"
        >
          Chỉnh sửa
        </button>
      </div>
    </div>
  );
};
export const ChatBody = ({
  user,
  roomId,
  messages,
  isTyping,
  isAssistantThinking,
  socketRef,
  setMessages,
  setUnreadCount,
  onConfirmAssistantAction,
  pendingAssistantDraftId,
  onPendingAssistantDraftChange,
  onOptimisticAssistantMessage,
  onAssistantRequestStart,
}: ChatBodyProps) => {
  const [page, setPage] = useState(1);

  const { data: messagesRoom, isPending } = useMessagesByRoom(roomId, {
    page,
    limit: 10,
    sortBy: "-createdAt",
  });

  const isLoadingOlderRef = useRef(false);
  const editInputRef = useRef<HTMLInputElement>(null);
  const chatBodyRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [hasMoreOld, setHasMoreOld] = useState(true);

  const [zoomImages, setZoomImages] = useState<string[]>([]);
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);

  const [editingText, setEditingText] = useState<string>("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
    setHasMoreOld(true);
  }, [roomId]);

  useEffect(() => {
    if (!messagesRoom?.data || !chatBodyRef.current) return;

    const chatContainer = chatBodyRef.current;
    const scrollHeightBefore = chatContainer.scrollHeight;

    setMessages((prevMessages) => {
      const existingIds = new Set(prevMessages.map((m) => m._id));
      const newMessages = messagesRoom.data.filter(
        (m) => !existingIds.has(m._id),
      );

      if (page > 1) {
        setTimeout(() => {
          const scrollHeightAfter = chatContainer.scrollHeight;
          chatContainer.scrollTop = scrollHeightAfter - scrollHeightBefore;
          isLoadingOlderRef.current = false;
        }, 0);
        return [...newMessages.reverse(), ...prevMessages];
      } else {
        return [...prevMessages, ...newMessages.reverse()];
      }
    });

    if (page === 1 && messagesRoom.data.length > 0) {
      const latestMessage = messagesRoom.data[0];
      if (typeof latestMessage.unreadCount === "number") {
        setUnreadCount(latestMessage.unreadCount);
      }
    }

    if (page >= (messagesRoom.totalPages || 1)) {
      setHasMoreOld(false);
    }
  }, [messagesRoom, page, setMessages, setUnreadCount]);

  useEffect(() => {
    if (page === 1) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping, isAssistantThinking, page]);

  useEffect(() => {
    if (editingMessageId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingMessageId]);

  const loadOlderMessages = () => {
    if (isLoadingOlderRef.current || page >= (messagesRoom?.totalPages || 1))
      return;
    isLoadingOlderRef.current = true;
    setPage((prev) => prev + 1);
  };

  const saveEditMessage = () => {
    if (!editingMessageId || !editingText.trim() || !socketRef.current) return;

    socketRef.current.emit("edit-message", {
      roomId,
      messageId: editingMessageId,
      newText: editingText.trim(),
    });

    setMessages((prev) =>
      prev.map((msg) =>
        msg._id === editingMessageId
          ? { ...msg, text: editingText.trim() }
          : msg,
      ),
    );

    setEditingText("");
    setEditingMessageId(null);
  };

  const handleConfirmDelete = (messageId: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit("delete-message", { messageId, roomId });

    setConfirmDeleteId(null);
    setMessages((prev) =>
      prev.map((msg) =>
        msg._id === messageId
          ? {
              ...msg,
              text: "Tin nhắn đã thu hồi",
              attachments: [],
              isDeleted: true,
            }
          : msg,
      ),
    );
  };

  const latestConversationMessage =
    [...messages]
      .reverse()
      .find(
        (message) =>
          !message.isDeleted &&
          message.metadata?.kind !== "assistant-action-confirmed",
      ) ?? null;
  const latestInteractiveMessageId =
    latestConversationMessage && hasInteractiveAssistantMetadata(latestConversationMessage)
      ? latestConversationMessage._id
      : null;
  const getAddDraftForProduct = (
    drafts: AssistantActionDraft[] | undefined,
    productId: string,
  ) =>
    drafts?.find((draft) => {
      const action = draft.action ?? draft.kind;
      return action === "CART_ADD" && draft.productId === productId;
    });

  const renderAssistantMetadata = (message: Message) => {
    if (message.isDeleted || message.metadata?.kind !== "assistant")
      return null;

    const metadata = message.metadata;
    const productCards = uniqueProductCards(metadata.productCards ?? []);
    const orderCards = metadata.orderCards ?? [];
    const isLatestInteractiveMessage =
      message._id === latestInteractiveMessageId;
    const actionDrafts = isLatestInteractiveMessage
      ? (metadata.actionDrafts ?? [])
      : [];
    const checkoutDraft = isLatestInteractiveMessage
      ? (metadata.actionDraft ??
        actionDrafts.find((draft) => {
          const action = draft.action ?? draft.kind;
          return action === "CHECKOUT_REDIRECT" || action === "CHECKOUT_PREP";
        }) ??
        null)
      : null;
    const visibleActionDrafts = checkoutDraft
      ? actionDrafts.filter((draft) => draft.draftId !== checkoutDraft.draftId)
      : actionDrafts;
    const showCheckoutReview =
      isLatestInteractiveMessage && Boolean(metadata.checkoutReview);
    const hasNoOrderResults =
      "orderCards" in metadata && orderCards.length === 0;
    const statusRows = [
      productCards.length > 0 ? "Sản phẩm phù hợp trong catalog GearVN" : null,
      visibleActionDrafts.length > 0 ? "Cần bạn xác nhận thao tác" : null,
      metadata.reviewSummary ? "Tóm tắt đánh giá từ nguồn liên quan" : null,
    ].filter(Boolean) as string[];
    const hasBlocks =
      productCards.length > 0 ||
      Boolean(metadata.reviewSummary) ||
      orderCards.length > 0 ||
      visibleActionDrafts.length > 0 ||
      showCheckoutReview ||
      hasNoOrderResults ||
      Boolean(metadata.handoff?.requested) ||
      Boolean(metadata.unsupportedReason);

    if (!hasBlocks) return null;

    return (
      <div className="mt-2 flex w-full min-w-0 flex-col gap-2">
        {statusRows.map((statusText) => (
          <div
            key={statusText}
            aria-live="polite"
            className="rounded-sm bg-gray-50 px-3 py-2 text-sm text-gray-500"
          >
            {statusText}
          </div>
        ))}
        {productCards.map((product) => (
          <AiProductCard
            key={product.productId}
            product={product}
            addDraft={getAddDraftForProduct(actionDrafts, product.productId)}
            pendingDraftId={pendingAssistantDraftId}
            onConfirmAction={onConfirmAssistantAction}
          />
        ))}

        {metadata.reviewSummary && (
          <AiReviewSummary summary={metadata.reviewSummary} />
        )}

        {!user && (orderCards.length > 0 || hasNoOrderResults) ? (
          <AiOrderCard isAuthenticated={false} />
        ) : orderCards.length > 0 ? (
          orderCards.map((order) => (
            <AiOrderCard
              key={
                order.orderId ||
                order.orderCode ||
                `${order.status}-${order.createdAt}`
              }
              order={order}
              isAuthenticated
            />
          ))
        ) : hasNoOrderResults ? (
          <AiOrderCard isAuthenticated />
        ) : null}

        {showCheckoutReview && metadata.checkoutReview && (
          <AiCheckoutReviewCard
            review={metadata.checkoutReview}
            draft={checkoutDraft}
            roomId={roomId}
            userId={user?._id}
            socketRef={socketRef}
            pendingDraftId={pendingAssistantDraftId}
            onConfirmAction={onConfirmAssistantAction}
            onOptimisticMessage={onOptimisticAssistantMessage}
            onAssistantRequestStart={onAssistantRequestStart}
          />
        )}

        {visibleActionDrafts.length > 0 && (
          <div className="flex w-full flex-col gap-2">
            {visibleActionDrafts.map((draft) => (
              <AiActionButton
                key={draft.draftId}
                draft={draft}
                roomId={roomId}
                socketRef={socketRef}
                pendingDraftId={pendingAssistantDraftId}
                onPendingDraftChange={onPendingAssistantDraftChange}
                onOptimisticMessage={onOptimisticAssistantMessage}
              />
            ))}
          </div>
        )}

        {metadata.handoff?.requested && (
          <div className="rounded-md border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-800">
            Đã chuyển cuộc trò chuyện cho nhân viên tư vấn.
          </div>
        )}

        {metadata.unsupportedReason && (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
            {formatUnsupportedReason(metadata.unsupportedReason)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      ref={chatBodyRef}
      className="flex-1 overflow-y-auto bg-gray-50 p-4 custom-scroll sm:p-6"
    >
      {user && isPending ? (
        <MessageSkeleton />
      ) : (
        <>
          {hasMoreOld && messages.length > 0 && (
            <div className="text-center mb-6">
              <Button
                size="sm"
                onClick={loadOlderMessages}
                className="inline-flex items-center justify-center gap-1 px-3 text-gray-700 bg-gray-200 hover:bg-gray-300"
              >
                <ArrowUp size={16} />
                Xem tin nhắn cũ
              </Button>
            </div>
          )}

          {messages.length === 0 ? (
            <div className="flex items-start mb-4">
              <div className="size-10 flex-shrink-0 overflow-hidden rounded-full">
                <Image
                  width={100}
                  height={100}
                  alt="Avatar"
                  src="/avatar-default.jpg"
                />
              </div>
              <div className="mx-3 flex min-w-0 max-w-[min(42rem,calc(100vw-5rem))] flex-col items-start text-sm sm:max-w-[min(42rem,78vw)]">
                <p className="text-gray-500 mb-1">GearVN</p>
                <div className="rounded-lg border bg-white p-3 text-base leading-relaxed text-gray-900 shadow-sm">
                  {DEFAULT_MESSAGE_CHAT.text}
                </div>
                <span
                  className="text-[10px] text-gray-400 mt-1"
                  suppressHydrationWarning
                >
                  {formatDateVi(new Date())}
                </span>
              </div>
            </div>
          ) : (
            messages.map((message, idx) => {
              const attachments = message.attachments ?? [];
              const isClient = message.sender === USER_ROLE.CUSTOMER;

              return (
                <div
                  key={idx}
                  className={cn(
                    "flex items-start mb-4",
                    (editingMessageId || confirmDeleteId) && "!max-w-full",
                    isClient
                      ? "max-w-[min(42rem,calc(100vw-5rem))] flex-row-reverse ml-auto sm:max-w-[min(42rem,78vw)]"
                      : "max-w-full flex-row",
                  )}
                >
                  <div className="size-10 flex-shrink-0 overflow-hidden rounded-full">
                    <Image
                      width={100}
                      height={100}
                      alt="Avatar"
                      src={
                        isClient
                          ? user?.avatarUrl || "/avatar-default.jpg"
                          : "/avatar-default.jpg"
                      }
                    />
                  </div>

                  <div
                    className={cn(
                      "mx-3 flex min-w-0 max-w-[min(42rem,calc(100vw-5rem))] flex-col text-sm sm:max-w-[min(42rem,78vw)]",
                      isClient ? "items-end" : "items-start",
                    )}
                  >
                    <p className="text-gray-500 mb-1">
                      {isClient
                        ? formatShortName(user?.fullName || "")
                        : message.messageKind === "assistant"
                          ? "AI GearVN"
                          : "Quản trị viên"}
                    </p>

                    <div className="relative group">
                      {editingMessageId === message._id ? (
                        // === Edit mode ===
                        <div className="w-full flex gap-2">
                          <Input
                            ref={editInputRef}
                            value={editingText}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                saveEditMessage();
                                e.preventDefault();
                              }
                            }}
                            onChange={(e) => setEditingText(e.target.value)}
                            className="flex-1 text-sm"
                          />
                          <Button
                            size="sm"
                            onClick={saveEditMessage}
                            className="text-white bg-primary hover:bg-primary/80"
                          >
                            Lưu
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              setEditingText("");
                              setEditingMessageId(null);
                            }}
                            className="text-gray-700 bg-gray-300 hover:bg-gray-300/80"
                          >
                            Hủy
                          </Button>
                        </div>
                      ) : confirmDeleteId === message._id ? (
                        // === Confirm delete mode ===
                        <div className="w-full flex gap-2 p-2 border border-red-300 bg-red-50 rounded-lg">
                          <Input
                            readOnly
                            value={message.text}
                            className="flex-1 text-sm bg-white cursor-not-allowed"
                          />
                          <Button
                            size="sm"
                            onClick={() => handleConfirmDelete(message._id!)}
                            className="text-white bg-primary hover:bg-primary/70"
                          >
                            Thu hồi
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-gray-700 bg-gray-300 hover:bg-gray-300/80"
                          >
                            Hủy
                          </Button>
                        </div>
                      ) : (
                        // === Normal message ===
                        <div
                          className={cn(
                            "relative group w-full break-words rounded-lg border p-3 text-base leading-relaxed shadow-sm",
                            isClient
                              ? message.isDeleted
                                ? "text-gray-500 italic bg-gray-200"
                                : "text-white bg-primary"
                              : message.isDeleted
                                ? "text-gray-400 italic bg-gray-100"
                                : "text-gray-900 bg-white",
                          )}
                        >
                          {message.isDeleted ? (
                            "Tin nhắn đã thu hồi"
                          ) : (
                            <>
                              {message.text && <p>{message.text}</p>}
                              {renderAssistantMetadata(message)}
                            </>
                          )}

                          {!message.isDeleted &&
                            isClient &&
                            !message.isDefault && (
                              <>
                                <div className="hidden sm:flex absolute top-1 -left-16 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => {
                                      setEditingMessageId(message._id!);
                                      setEditingText(message.text || "");
                                    }}
                                    className="text-primary p-1 cursor-pointer"
                                  >
                                    <Edit width={16} height={16} />
                                  </button>
                                  <button
                                    onClick={() =>
                                      setConfirmDeleteId(message._id!)
                                    }
                                    className="text-primary p-1 cursor-pointer"
                                  >
                                    <Trash width={16} height={16} />
                                  </button>
                                </div>

                                <div className="sm:hidden absolute top-1 -left-8">
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <button className="p-1 text-gray-600 cursor-pointer">
                                        <MoreVertical width={16} height={16} />
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-32 p-2 flex flex-col space-y-1">
                                      <button
                                        onClick={() => {
                                          setEditingMessageId(message._id!);
                                          setEditingText(message.text || "");
                                        }}
                                        className="flex items-center gap-2 p-1 hover:bg-gray-100 rounded cursor-pointer"
                                      >
                                        <Edit width={14} height={14} /> Sửa
                                      </button>
                                      <button
                                        onClick={() =>
                                          setConfirmDeleteId(message._id!)
                                        }
                                        className="flex items-center gap-2 p-1 hover:bg-red-500/20 rounded text-red-600 cursor-pointer"
                                      >
                                        <Trash width={14} height={14} /> Thu hồi
                                      </button>
                                    </PopoverContent>
                                  </Popover>
                                </div>
                              </>
                            )}
                        </div>
                      )}
                    </div>

                    {!message.isDeleted && attachments.length > 0 && (
                      <div
                        className={cn(
                          "flex gap-2 mt-2",
                          isClient ? "justify-end" : "justify-start",
                        )}
                      >
                        {attachments
                          .slice(0, 2)
                          .map((url: string, i: number) => (
                            <div
                              key={i}
                              onClick={() => {
                                setZoomIndex(i);
                                setZoomImages(attachments);
                              }}
                              className="relative size-16 border overflow-hidden rounded-lg cursor-zoom-in"
                            >
                              <Image
                                fill
                                src={url}
                                alt={`Attachment ${i + 1}`}
                                className="object-contain"
                              />
                            </div>
                          ))}
                        {attachments.length > 2 && (
                          <div
                            onClick={() => {
                              setZoomIndex(2);
                              setZoomImages(attachments);
                            }}
                            className="relative size-16 overflow-hidden rounded-lg cursor-zoom-in"
                          >
                            <Image
                              fill
                              alt="More"
                              src={attachments[2]}
                              className="object-contain"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                              <span className="text-lg font-semibold text-white">
                                +{attachments.length - 2}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <span className="text-[10px] text-gray-400 mt-1">
                      {message.createdAt
                        ? formatDateTimeVi(new Date(message.createdAt))
                        : ""}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </>
      )}

      {isAssistantThinking && (
        <div className="mb-4 flex items-start" aria-live="polite" role="status">
          <div className="size-10 flex-shrink-0 overflow-hidden rounded-full">
            <Image
              width={100}
              height={100}
              alt="Avatar"
              src="/avatar-default.jpg"
            />
          </div>
          <div className="mx-3 flex min-w-0 max-w-[min(42rem,calc(100vw-5rem))] flex-col items-start text-sm sm:max-w-[min(42rem,78vw)]">
            <p className="mb-1 text-gray-500">AI GearVN</p>
            <div className="inline-flex max-w-full items-center gap-2 rounded-lg border bg-white p-3 text-sm leading-relaxed text-gray-700 shadow-sm">
              <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
              <span>AI GearVN đang suy nghĩ...</span>
            </div>
          </div>
        </div>
      )}
      {isTyping && (
        <p className="absolute left-0 bottom-[70px] sm:bottom-[53px] w-full text-[13px] text-muted-foreground py-1 px-4 bg-white italic mt-2">
          Quản trị viên đang soạn tin...
        </p>
      )}

      <div ref={messagesEndRef}></div>

      {zoomIndex !== null && (
        <Lightbox
          index={zoomIndex}
          open={zoomIndex !== null}
          close={() => setZoomIndex(null)}
          slides={zoomImages.map((src) => ({ src }))}
          plugins={[Zoom, Fullscreen, Slideshow, Thumbnails]}
        />
      )}
    </div>
  );
};
