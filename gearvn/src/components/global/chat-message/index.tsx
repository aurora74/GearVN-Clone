"use client";

import { useState, useEffect, useRef, useCallback } from "react";

import { MessageSquare } from "lucide-react";
import { io, Socket } from "socket.io-client";

import { cn } from "@/utils/cn";
import { Message } from "@/types/chat";
import { USER_ROLE } from "@/config.global";
import { useMe } from "@/react-query/query/user";

import { ChatBody } from "./chat-body";
import { ChatInput } from "./chat-input";
import { ChatHeader } from "./chat-header";
import { ChatPreview } from "./chat-preview";

const haveSameAttachments = (left: string[] = [], right: string[] = []) => {
  if (left.length !== right.length) return false;
  return left.every((url, index) => url === right[index]);
};

const isMatchingOptimisticMessage = (message: Message, savedMessage: Message) =>
  message._id?.startsWith("optimistic-") &&
  message.sender === savedMessage.sender &&
  message.text === savedMessage.text &&
  haveSameAttachments(message.attachments, savedMessage.attachments);

export const ChatMessage = () => {
  const { data: user } = useMe();

  const socketRef = useRef<Socket | null>(null);

  const [unreadCount, setUnreadCount] = useState(0);

  const [open, setOpen] = useState(false);
  const openRef = useRef(open);
  const [isTyping, setIsTyping] = useState(false);

  const [previews, setPreviews] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);

  const roomId = user ? `room-client-${user._id}` : undefined;

  useEffect(() => {
    if (!user) {
      setMessages([]);
      setUnreadCount(0);
    }
  }, [user]);

  const markAdminMessagesAsRead = useCallback(
    (messagesArray: Message[]) => {
      if (!socketRef.current) return;

      const unreadAdminMessageIds = messagesArray
        .filter(
          (message) =>
            message.sender === USER_ROLE.ADMIN &&
            !message.isRead &&
            !message.isDeleted
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
            : message
        )
      );
    },
    [roomId]
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

            setMessages((prevMessages) => {
              const hasSavedMessage = prevMessages.some((m) => m._id === msg._id);
              const baseMessages = prevMessages.filter(
                (message) => !isMatchingOptimisticMessage(message, msg)
              );

              if (hasSavedMessage) return baseMessages;

              const isChatOpen = openRef.current;
              const newMessage = {
                ...msg,
                isRead: isChatOpen && msg.sender === USER_ROLE.ADMIN,
              };

              if (isChatOpen && msg.sender === USER_ROLE.ADMIN && socketRef.current) {
                setUnreadCount(0);
                markAdminMessagesAsRead([...baseMessages, newMessage]);
              }

              if (!isChatOpen && msg.sender === USER_ROLE.ADMIN) {
                setUnreadCount((prevCount) =>
                  typeof msg.unreadCount === "number"
                    ? msg.unreadCount
                    : prevCount + 1
                );
              }

              return [...baseMessages, newMessage];
            });
          }
        );

        socketClient.on("message-edited", (editedMessage: Message) => {
          setMessages((prevMessages) =>
            prevMessages.map((message) =>
              message._id === editedMessage._id
                ? { ...message, ...editedMessage }
                : message
            )
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
                  : message
              )
            );
          }
        );

        socketClient.on(
          "typing",
          (event: { roomId: string; from: string; typing: boolean }) => {
            if (event.roomId !== roomId) return;
            const isAdminTyping =
              event.from === USER_ROLE.ADMIN ? event.typing : false;
            setIsTyping(isAdminTyping);
          }
        );

        socketClient.on(
          "message-read",
          (event: { messageId: string; isRead: boolean }) => {
            const { messageId, isRead } = event;

            setMessages((prevMessages) =>
              prevMessages.map((message) =>
                message._id === messageId ? { ...message, isRead } : message
              )
            );
          }
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
  }, [roomId, user?._id, markAdminMessagesAsRead]);

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
    [roomId, user]
  );

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
      <div
        onClick={handleOpenChat}
        className="w-fit fixed bottom-[55px] sm:bottom-0 right-0 flex items-center gap-2 py-2 px-3 text-white bg-primary rounded-tl-lg shadow-lg transition cursor-pointer z-50"
      >
        <MessageSquare className="size-5" />
        <p className="text-sm font-medium">
          Chat tư vấn - Giải đáp mọi thắc mắc
        </p>
        {unreadCount > 0 && (
          <span className="flex items-center justify-center size-4.5 ml-2 text-sm text-primary font-bold bg-white rounded-full">
            {unreadCount}
          </span>
        )}
      </div>

      <div
        className={cn(
          "fixed bottom-16 right-4 w-[24rem] h-[520px] flex flex-col border border-gray-200 bg-white rounded-lg shadow-2xl transform transition-all duration-300 ease-in-out z-50",
          open
            ? "translate-y-0 opacity-100 scale-100"
            : "translate-y-8 opacity-0 scale-95 pointer-events-none"
        )}
      >
        <ChatHeader onClose={() => setOpen(false)} />

        <ChatBody
          user={user ?? null}
          messages={messages}
          isTyping={isTyping}
          roomId={roomId ?? ""}
          socketRef={socketRef}
          setMessages={setMessages}
          setUnreadCount={setUnreadCount}
        />

        <ChatInput
          user={user ?? null}
          roomId={roomId ?? ""}
          socketRef={socketRef}
          onOptimisticMessage={handleOptimisticMessage}
        />

        <ChatPreview
          previews={previews}
          setPreviews={setPreviews}
          uploadedUrls={uploadedUrls}
          setUploadedUrls={setUploadedUrls}
        />
      </div>
    </>
  );
};
