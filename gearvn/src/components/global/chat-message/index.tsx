"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

import { MessageSquare } from "lucide-react";
import { io, Socket } from "socket.io-client";

import {
  AssistantActionDraft,
  AssistantConfirmedAction,
  AssistantMode,
  AssistantProductCard,
  Message,
} from "@/types/chat";
import { USER_ROLE } from "@/config.global";
import { useMe } from "@/react-query/query/user";
import { CartItemType } from "@/types/order";
import { useCartStore } from "@/stores/use-cart-store";
import { useOrderStore } from "@/stores/use-order-store";

import { ChatBody } from "./chat-body";
import { ChatInput } from "./chat-input";
import { ChatHeader } from "./chat-header";
import { ChatPreview } from "./chat-preview";
import { AiModeControl } from "./ai-mode-control";

const haveSameAttachments = (left: string[] = [], right: string[] = []) => {
  if (left.length !== right.length) return false;
  return left.every((url, index) => url === right[index]);
};

const isMatchingOptimisticMessage = (message: Message, savedMessage: Message) =>
  message._id?.startsWith("optimistic-") &&
  message.sender === savedMessage.sender &&
  message.text === savedMessage.text &&
  haveSameAttachments(message.attachments, savedMessage.attachments);

type CheckoutFields = {
  name?: string;
  phone?: string;
  address?: string;
};

const isCheckoutFields = (value: unknown): value is CheckoutFields =>
  Boolean(
    value &&
    typeof value === "object" &&
    "name" in value &&
    "phone" in value &&
    "address" in value,
  );

const toCartItem = (
  product: AssistantProductCard,
  quantity: number,
): CartItemType => {
  const price = product.price ?? product.discountPrice ?? 0;
  const finalPrice = product.discountPrice ?? product.price ?? 0;

  return {
    id: product.productId,
    slug: product.slug ?? product.productId,
    name: product.name,
    price,
    image: product.image || "/avatar-default.jpg",
    quantity,
    finalPrice,
    clientFinalPrice: finalPrice,
  };
};

const buildAssistantErrorMessage = (
  roomId: string,
  message: string,
): Message => ({
  _id: `assistant-error-${Date.now()}`,
  text: message || "AI GearVN chưa xử lý được yêu cầu này. Vui lòng thử lại.",
  roomId,
  createdAt: new Date().toISOString(),
  unreadCount: 0,
  attachments: [],
  sender: USER_ROLE.ADMIN,
  userId: {
    _id: "gearvn-ai",
    fullName: "AI GearVN",
  },
  isRead: true,
  isDeleted: false,
  messageKind: "assistant",
  metadata: {
    kind: "assistant",
    mode: "ai",
    unsupportedReason: message,
    error: { code: "chat-error", message },
  },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getDraftPayload = (draft: AssistantActionDraft) =>
  isRecord(draft.payload) ? draft.payload : {};

const coerceCheckoutDetails = (
  value: unknown,
): AssistantActionDraft["checkout"] => {
  if (!isRecord(value)) return undefined;

  const checkout: AssistantActionDraft["checkout"] = {};
  if (typeof value.name === "string") checkout.name = value.name;
  if (typeof value.phone === "string") checkout.phone = value.phone;
  if (typeof value.address === "string") checkout.address = value.address;

  return Object.keys(checkout).length ? checkout : undefined;
};

const getDraftCheckout = (
  draft: AssistantActionDraft,
): AssistantActionDraft["checkout"] => {
  if (draft.checkout) return draft.checkout;
  return coerceCheckoutDetails(getDraftPayload(draft).checkout);
};

const getDraftProductId = (draft: AssistantActionDraft) => {
  const payload = getDraftPayload(draft);
  return (
    draft.productId ??
    (typeof payload.productId === "string" ? payload.productId : undefined)
  );
};

const getDraftQuantity = (draft: AssistantActionDraft) => {
  const payload = getDraftPayload(draft);
  const value = draft.quantity ?? payload.quantity;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
};

const getDraftVoucherCode = (draft: AssistantActionDraft) => {
  const payload = getDraftPayload(draft);
  return (
    draft.voucherCode ??
    (typeof payload.voucherCode === "string" ? payload.voucherCode : undefined)
  );
};
export const ChatMessage = () => {
  const { data: user } = useMe();
  const router = useRouter();
  const cartItems = useCartStore((state) => state.items);
  const addToCart = useCartStore((state) => state.addToCart);
  const removeFromCart = useCartStore((state) => state.removeFromCart);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const setOrder = useOrderStore((state) => state.setOrder);
  const setVoucher = useOrderStore((state) => state.setVoucher);

  const socketRef = useRef<Socket | null>(null);

  const [unreadCount, setUnreadCount] = useState(0);

  const [open, setOpen] = useState(false);
  const openRef = useRef(open);
  const processedConfirmedDraftIds = useRef(new Set<string>());
  const [isTyping, setIsTyping] = useState(false);
  const [isAssistantThinking, setIsAssistantThinking] = useState(false);

  const [previews, setPreviews] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [assistantMode, setAssistantMode] = useState<AssistantMode>("ai");
  const [assistantStatusText, setAssistantStatusText] =
    useState("AI đang tư vấn");
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [confirmedActionResults, setConfirmedActionResults] = useState<
    AssistantConfirmedAction[]
  >([]);

  const roomId = user ? `room-client-${user._id}` : undefined;

  useEffect(() => {
    setMessages([]);
    setUnreadCount(0);
    setAssistantMode("ai");
    setAssistantStatusText("AI đang tư vấn");
    setIsAssistantThinking(false);
    setIsTyping(false);
    setPendingActionId(null);
    setConfirmedActionResults([]);
    processedConfirmedDraftIds.current.clear();
  }, [roomId]);

  const appendConfirmedAction = useCallback(
    (action: AssistantConfirmedAction) => {
      setConfirmedActionResults((prevResults) =>
        prevResults.some((result) => result.draftId === action.draftId)
          ? prevResults
          : [...prevResults, action],
      );
    },
    [],
  );

  const markAdminMessagesAsRead = useCallback(
    (messagesArray: Message[]) => {
      if (!socketRef.current) return;

      const unreadAdminMessageIds = messagesArray
        .filter(
          (message) =>
            message.sender === USER_ROLE.ADMIN &&
            !message.isRead &&
            !message.isDeleted,
        )
        .map((message) => message._id);

      if (unreadAdminMessageIds.length === 0) return;

      socketRef.current.emit("mark-as-read-bulk", {
        messageIds: unreadAdminMessageIds,
        roomId,
      });

      setMessages((prevMessages) =>
        prevMessages.map((message) =>
          message.sender === USER_ROLE.ADMIN && !message.isRead
            ? { ...message, isRead: true }
            : message,
        ),
      );
    },
    [roomId],
  );

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!user?._id || !roomId) return;

    let isCancelled = false;
    let socketClient: Socket | null = null;

    const initSocket = async () => {
      try {
        const response = await fetch("/api/chat/socket/connect", {
          credentials: "include",
        });
        if (!response.ok) return;

        const { url, token } = await response.json();
        if (isCancelled || !url || !token) return;

        socketClient = io(url, {
          auth: { token },
        });
        socketRef.current = socketClient;

        socketClient.emit("join-room", roomId);

        socketClient.on(
          "receive-message",
          (msg: Message & { unreadCount?: number }) => {
            if (!msg || msg.roomId !== roomId) return;

            const messageMetadata = msg.metadata;
            const isAssistantMessage =
              msg.messageKind === "assistant" ||
              messageMetadata?.kind === "assistant";
            if (isAssistantMessage) setIsAssistantThinking(false);
            if (messageMetadata?.mode) {
              setAssistantMode(messageMetadata.mode);
              setAssistantStatusText(
                messageMetadata.mode === "staff"
                  ? "Nhân viên đang hỗ trợ"
                  : "AI đang tư vấn",
              );
            }

            const nextDraftId = messageMetadata?.actionDrafts?.[0]?.draftId;
            if (nextDraftId) {
              setAssistantStatusText("AI đang chờ bạn xác nhận thao tác");
            }

            const confirmedAction = messageMetadata?.confirmed;
            if (
              messageMetadata?.kind === "assistant-action-confirmed" &&
              confirmedAction?.confirmedByBackend
            ) {
              appendConfirmedAction(confirmedAction);
              setPendingActionId(null);
              setAssistantStatusText(confirmedAction.displayText);
            }

            setMessages((prevMessages) => {
              const hasSavedMessage = prevMessages.some(
                (m) => m._id === msg._id,
              );
              const baseMessages = prevMessages.filter(
                (message) => !isMatchingOptimisticMessage(message, msg),
              );

              if (hasSavedMessage) return baseMessages;

              const isChatOpen = openRef.current;
              const newMessage = {
                ...msg,
                isRead: isChatOpen && msg.sender === USER_ROLE.ADMIN,
              };

              if (
                isChatOpen &&
                msg.sender === USER_ROLE.ADMIN &&
                socketRef.current
              ) {
                setUnreadCount(0);
                markAdminMessagesAsRead([...baseMessages, newMessage]);
              }

              if (!isChatOpen && msg.sender === USER_ROLE.ADMIN) {
                setUnreadCount((prevCount) =>
                  typeof msg.unreadCount === "number"
                    ? msg.unreadCount
                    : prevCount + 1,
                );
              }

              return [...baseMessages, newMessage];
            });
          },
        );

        socketClient.on(
          "assistant-mode-updated",
          (event: { roomId: string; mode: AssistantMode }) => {
            if (event.roomId !== roomId) return;

            setAssistantMode(event.mode);
            setAssistantStatusText(
              event.mode === "staff"
                ? "Nhân viên đang hỗ trợ"
                : "AI đang tư vấn",
            );
            if (event.mode === "staff") {
              setIsAssistantThinking(false);
              setPendingActionId(null);
            }
          },
        );

        socketClient.on("chat-error", (event: { message?: string }) => {
          const message =
            event?.message ||
            "AI GearVN chưa xử lý được yêu cầu này. Vui lòng thử lại.";
          setPendingActionId(null);
          setIsAssistantThinking(false);
          setAssistantStatusText(message);
          setMessages((prevMessages) => {
            const lastMessage = prevMessages[prevMessages.length - 1];
            if (
              lastMessage?.messageKind === "assistant" &&
              lastMessage.metadata?.error?.code === "chat-error" &&
              lastMessage.text === message
            ) {
              return prevMessages;
            }
            return [
              ...prevMessages,
              buildAssistantErrorMessage(roomId, message),
            ];
          });
        });

        socketClient.on("disconnect", () => {
          setIsAssistantThinking(false);
        });
        socketClient.on(
          "assistant-action-confirmed",
          (event: AssistantConfirmedAction) => {
            if (!event.confirmedByBackend) return;

            appendConfirmedAction(event);
            setPendingActionId(null);
            setIsAssistantThinking(false);
            setAssistantStatusText(event.displayText);
          },
        );

        socketClient.on("message-edited", (editedMessage: Message) => {
          setMessages((prevMessages) =>
            prevMessages.map((message) =>
              message._id === editedMessage._id
                ? { ...message, ...editedMessage }
                : message,
            ),
          );
        });

        socketClient.on(
          "message-deleted",
          ({ messageId }: { messageId: string }) => {
            setMessages((prevMessages) =>
              prevMessages.map((message) =>
                message._id === messageId
                  ? {
                      ...message,
                      attachments: [],
                      isDeleted: true,
                      text: "Tin nhắn đã thu hồi",
                    }
                  : message,
              ),
            );
          },
        );

        socketClient.on(
          "typing",
          (event: { roomId: string; from: string; typing: boolean }) => {
            if (event.roomId !== roomId) return;
            const isAdminTyping =
              event.from === USER_ROLE.ADMIN ? event.typing : false;
            setIsTyping(isAdminTyping);
          },
        );

        socketClient.on(
          "message-read",
          (event: { messageId: string; isRead: boolean }) => {
            const { messageId, isRead } = event;

            setMessages((prevMessages) =>
              prevMessages.map((message) =>
                message._id === messageId ? { ...message, isRead } : message,
              ),
            );
          },
        );
      } catch {
        if (!isCancelled) socketRef.current = null;
      }
    };

    initSocket();

    return () => {
      isCancelled = true;
      socketClient?.disconnect();
      if (socketRef.current === socketClient) socketRef.current = null;
    };
  }, [roomId, user?._id, markAdminMessagesAsRead, appendConfirmedAction]);

  const handleOptimisticMessage = useCallback(
    ({
      text,
      attachments,
      createdAt,
    }: {
      text: string;
      attachments: string[];
      createdAt: string;
    }) => {
      if (!user || !roomId) return;

      const optimisticMessage: Message = {
        _id: `optimistic-${createdAt}-${Math.random().toString(36).slice(2)}`,
        text,
        sender: USER_ROLE.CUSTOMER,
        roomId,
        userId: {
          _id: user._id,
          fullName: user.fullName,
          avatarUrl: user.avatarUrl,
        },
        isRead: false,
        isDeleted: false,
        unreadCount: 0,
        createdAt,
        attachments,
        isDefault: true,
      };

      setMessages((prevMessages) => [...prevMessages, optimisticMessage]);
    },
    [roomId, user],
  );

  const handleAssistantRequestStart = useCallback(() => {
    if (assistantMode !== "ai") return;
    setIsAssistantThinking(true);
    setAssistantStatusText("AI GearVN đang suy nghĩ...");
  }, [assistantMode]);

  const handleAssistantModeChange = useCallback(
    (mode: AssistantMode) => {
      if (!roomId || !socketRef.current) return;

      const displayText =
        mode === "staff" ? "Chat với nhân viên tư vấn" : "Tiếp tục với AI";
      const createdAt = new Date().toISOString();

      socketRef.current.emit("assistant-switch-mode", {
        roomId,
        mode,
        displayText,
      });
      handleOptimisticMessage({
        text: displayText,
        attachments: [],
        createdAt,
      });
      setAssistantMode(mode);
      setAssistantStatusText(
        mode === "staff" ? "Nhân viên đang hỗ trợ" : "AI đang tư vấn",
      );
      if (mode === "staff") {
        setPendingActionId(null);
        setIsAssistantThinking(false);
      }
    },
    [handleOptimisticMessage, roomId],
  );

  const handleConfirmAssistantAction = useCallback(
    (draft: AssistantActionDraft) => {
      if (!roomId || !socketRef.current) return;

      const displayText = draft.displayText || "Thêm vào giỏ";
      const checkout = getDraftCheckout(draft);
      socketRef.current.emit("assistant-confirm-action", {
        roomId,
        draftId: draft.draftId,
        displayText,
        productId: getDraftProductId(draft),
        quantity: getDraftQuantity(draft),
        voucherCode: getDraftVoucherCode(draft),
        checkout,
      });
      handleOptimisticMessage({
        text: displayText,
        attachments: [],
        createdAt: new Date().toISOString(),
      });
      setPendingActionId(draft.draftId);
      setIsAssistantThinking(false);
    },
    [handleOptimisticMessage, roomId],
  );
  const lastConfirmedAction =
    confirmedActionResults[confirmedActionResults.length - 1] ?? null;
  const assistantLiveText = isAssistantThinking
    ? "AI GearVN đang suy nghĩ..."
    : lastConfirmedAction
      ? `${lastConfirmedAction.displayText} đã được backend xác nhận`
      : pendingActionId
        ? "AI đang chờ bạn xác nhận thao tác"
        : assistantStatusText;

  useEffect(() => {
    if (!lastConfirmedAction?.confirmedByBackend) return;
    if (processedConfirmedDraftIds.current.has(lastConfirmedAction.draftId)) {
      return;
    }

    const actionKind = lastConfirmedAction.action ?? lastConfirmedAction.kind;
    const productId = lastConfirmedAction.productId;
    const quantity = lastConfirmedAction.quantity ?? 1;
    let applied = false;

    if (actionKind === "CART_REMOVE" && productId) {
      removeFromCart(productId);
      applied = true;
    } else if (actionKind === "CART_SET_QUANTITY" && productId) {
      updateQuantity(productId, quantity);
      applied = true;
    } else if (actionKind === "CART_ADD" && productId) {
      const cartItem = lastConfirmedAction.cartItem;
      const product =
        lastConfirmedAction.product ??
        messages
          .flatMap((message) => message.metadata?.productCards ?? [])
          .find((card) => card.productId === productId);
      if (cartItem) {
        addToCart(cartItem);
        applied = true;
      } else if (product) {
        addToCart(toCartItem(product, quantity));
        applied = true;
      }
    } else if (
      actionKind === "APPLY_VOUCHER" &&
      lastConfirmedAction.voucherCode
    ) {
      setVoucher({
        voucherCode: lastConfirmedAction.voucherCode,
        voucherDiscountAmount: 0,
        voucherDescription: "Voucher đã được backend xác nhận",
        voucherAppliedSubtotal: 0,
      });
      applied = true;
    } else if (
      (actionKind === "CHECKOUT_REDIRECT" || actionKind === "CHECKOUT_PREP") &&
      isCheckoutFields(lastConfirmedAction.checkout)
    ) {
      const checkout = lastConfirmedAction.checkout;
      const items = cartItems.map((item) => ({
        productId: item.id,
        quantity: item.quantity,
        clientFinalPrice: item.clientFinalPrice ?? item.finalPrice,
      }));
      const totalAmount = cartItems.reduce(
        (total, item) =>
          total + (item.clientFinalPrice ?? item.finalPrice) * item.quantity,
        0,
      );

      setOrder({
        fullName: checkout.name ?? "",
        phone: checkout.phone ?? "",
        address: checkout.address ?? "",
        voucherCode: lastConfirmedAction.voucherCode,
        items,
        totalAmount,
      });
      router.push(lastConfirmedAction.redirectPath || "/cart?step=payment");
      applied = true;
    }

    if (applied) {
      processedConfirmedDraftIds.current.add(lastConfirmedAction.draftId);
    }
  }, [
    addToCart,
    cartItems,
    lastConfirmedAction,
    messages,
    removeFromCart,
    router,
    setOrder,
    setVoucher,
    updateQuantity,
  ]);

  const handleOpenChat = () => {
    setOpen((prevIsOpen) => {
      const nextIsOpen = !prevIsOpen;
      if (nextIsOpen && socketRef.current && messages.length > 0) {
        markAdminMessagesAsRead(messages);
        setUnreadCount(0);
      }
      return nextIsOpen;
    });
  };

  return (
    <>
      {!open && (
        <div
          onClick={handleOpenChat}
          className="fixed bottom-4 right-4 z-50 flex w-fit cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-3 text-white shadow-lg transition hover:bg-primary/90"
        >
          <MessageSquare className="size-5" />
          <p className="text-sm font-medium">Hỏi trợ lý AI</p>
          {unreadCount > 0 && (
            <span className="flex items-center justify-center size-4.5 ml-2 text-sm text-primary font-bold bg-white rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col overflow-hidden border border-gray-200 bg-white shadow-2xl sm:inset-6 lg:inset-10 xl:inset-12 sm:rounded-xl">
          <ChatHeader
            assistantMode={assistantMode}
            onClose={() => setOpen(false)}
          />

          <AiModeControl
            mode={assistantMode}
            onModeChange={handleAssistantModeChange}
          />

          <div
            aria-live="polite"
            className="border-b bg-muted/40 px-5 py-3 text-sm text-muted-foreground"
          >
            {assistantMode === "staff" ? "AI đang tạm dừng" : assistantLiveText}
          </div>

          <ChatBody
            user={user ?? null}
            messages={messages}
            isTyping={isTyping}
            isAssistantThinking={isAssistantThinking}
            roomId={roomId ?? ""}
            socketRef={socketRef}
            setMessages={setMessages}
            setUnreadCount={setUnreadCount}
            onConfirmAssistantAction={handleConfirmAssistantAction}
            pendingAssistantDraftId={pendingActionId}
            onPendingAssistantDraftChange={setPendingActionId}
            onOptimisticAssistantMessage={handleOptimisticMessage}
            onAssistantRequestStart={handleAssistantRequestStart}
          />

          <ChatInput
            user={user ?? null}
            roomId={roomId ?? ""}
            socketRef={socketRef}
            onOptimisticMessage={handleOptimisticMessage}
            onAssistantRequestStart={handleAssistantRequestStart}
          />

          <ChatPreview
            previews={previews}
            setPreviews={setPreviews}
            uploadedUrls={uploadedUrls}
            setUploadedUrls={setUploadedUrls}
          />
        </div>
      )}
    </>
  );
};
