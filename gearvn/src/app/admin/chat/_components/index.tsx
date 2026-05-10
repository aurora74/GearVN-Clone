"use client";

import { useState, useEffect, useRef } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { ArrowLeft } from "lucide-react";
import { io, Socket } from "socket.io-client";

import { cn } from "@/utils/cn";
import { SUPPORT_TICKET_SOURCE, USER_ROLE } from "@/config.global";
import { User, Message } from "@/types/chat";
import { useLatestMessages } from "@/react-query/query/chat";
import { useSupportTickets } from "@/react-query/query/engagement";
import { useResolveChatTicket } from "@/react-query/mutation/chat";
import { queryKeys } from "@/react-query/query-keys";

import { Sidebar } from "./sidebar";
import { ChatInput } from "./chat-input";
import { ChatHeader } from "./chat-header";
import { ChatMessages } from "./chat-messages";
import { SupportTicketPanel } from "./support-ticket-panel";
import { StaffAiSummaryPanel } from "./staff-ai-summary-panel";

const getMessageUser = (message: Message): Message["userId"] | null => {
  const user = message.userId as unknown;
  if (!user) return null;

  if (typeof user === "string") {
    return { _id: user, fullName: "Ẩn danh" };
  }

  return user as Message["userId"];
};

const getSidebarText = (message: Message) =>
  message.isDeleted ? "Tin nhắn đã thu hồi" : message.text || "[Ảnh]";

const haveSameAttachments = (left: string[] = [], right: string[] = []) => {
  if (left.length !== right.length) return false;
  return left.every((url, index) => url === right[index]);
};

const isMatchingOptimisticMessage = (message: Message, savedMessage: Message) =>
  message._id?.startsWith("optimistic-") &&
  message.sender === savedMessage.sender &&
  message.text === savedMessage.text &&
  haveSameAttachments(message.attachments, savedMessage.attachments);

export const ChatPage = () => {
  const queryClient = useQueryClient();
  const [search] = useQueryState("search", { shallow: false, history: "push" });

  const { data: latestData, isPending } = useLatestMessages({
    page: 1,
    limit: 20,
    ...(search ? { search } : {}),
  });
  const { data: supportTickets } = useSupportTickets({ page: 1, limit: 100 });
  const { mutate: resolveChatTicket, isPending: isResolvingTicket } =
    useResolveChatTicket();

  const [users, setUsers] = useState<User[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const selectedUserRef = useRef<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const selectedUserData = users.find((u) => u._id === selectedUser);
  const selectedRoomId = selectedUser ? `room-client-${selectedUser}` : "";
  const selectedTicket = supportTickets?.data?.find(
    (ticket) =>
      ticket.sourceType === SUPPORT_TICKET_SOURCE.CHAT &&
      ticket.roomId === selectedRoomId
  );

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  useEffect(() => {
    const fetchSocketContext = async () => {
      const response = await fetch("/api/chat/socket/connect", {
        credentials: "include",
      });
      const { url, token } = await response.json();
      return { url, token } as { url?: string; token?: string | null };
    };

    let socket: Socket | null = null;

    fetchSocketContext().then(({ url, token }) => {
      if (!url || !token) return;

      socket = io(url, {
        auth: { token },
      });
      socketRef.current = socket;

      socket.on("user-online", (data: { userId: string; online: boolean }) => {
        const { userId, online } = data;

        setUsers((prevUsers) => {
          return prevUsers.map((user) => {
            if (user._id === userId) {
              return { ...user, online };
            } else {
              return user;
            }
          });
        });
      });

      socket.on("receive-message", (msg: Message) => {
        const messageUser = getMessageUser(msg);
        const userId = messageUser?._id;
        if (!userId) return;

        const incomingMessage: Message = { ...msg, userId: messageUser };
        const isRoomCurrentlyOpen = selectedUserRef.current === userId;
        const isMessageFromCustomer = msg.sender === USER_ROLE.CUSTOMER;

        if (isMessageFromCustomer) {
          queryClient.invalidateQueries({ queryKey: queryKeys.supportTicket.root });
        }

        if (isRoomCurrentlyOpen && isMessageFromCustomer) {
          incomingMessage.isRead = true;
          socketRef.current?.emit("mark-as-read-bulk", {
            messageIds: [msg._id],
            roomId: msg.roomId,
          });
        }

        const sidebarText = getSidebarText(incomingMessage);
        const messageTime = new Date(
          msg.createdAt ?? Date.now()
        ).toLocaleTimeString();

        setUsers((prevUsers) => {
          let foundUser = false;

          const nextUsers = prevUsers.map((user) => {
            if (user._id !== userId) return user;
            foundUser = true;

            const baseMessages = user.messages.filter(
              (message) => !isMatchingOptimisticMessage(message, incomingMessage)
            );
            const hasSavedMessage = user.messages.some(
              (message) => message._id === incomingMessage._id
            );
            const nextMessages = hasSavedMessage
              ? baseMessages
              : [...baseMessages, incomingMessage];

            const updatedUnreadCount = isMessageFromCustomer
              ? isRoomCurrentlyOpen
                ? 0
                : typeof msg.unreadCount === "number"
                ? msg.unreadCount
                : user.unreadCount + 1
              : user.unreadCount;

            return {
              ...user,
              online: true,
              typing: false,
              newMessage: sidebarText,
              unreadCount: updatedUnreadCount,
              messages: nextMessages,
              time: messageTime,
            };
          });

          if (foundUser) return nextUsers;

          return [
            {
              _id: userId,
              fullName: messageUser.fullName?.trim() || "Ẩn danh",
              avatarUrl: messageUser.avatarUrl,
              online: true,
              typing: false,
              newMessage: sidebarText,
              unreadCount:
                isMessageFromCustomer && !isRoomCurrentlyOpen
                  ? msg.unreadCount || 1
                  : 0,
              messages: [incomingMessage],
              time: messageTime,
            },
            ...nextUsers,
          ];
        });
      });

      socket.on("message-edited", (updatedMessage: Message) => {
        setUsers((prevUsers) => {
          return prevUsers.map((user) => {
            const updatedMessages = user.messages.map((message) =>
              message._id === updatedMessage._id ? updatedMessage : message
            );

            const lastMessage = updatedMessages[updatedMessages.length - 1];
            const sidebarText = lastMessage.isDeleted
              ? "Tin nhắn đã thu hồi"
              : lastMessage.text;

            return {
              ...user,
              newMessage: sidebarText,
              messages: updatedMessages,
            };
          });
        });
      });

      socket.on("message-deleted", ({ messageId }: { messageId: string }) => {
        setUsers((prevUsers) => {
          return prevUsers.map((user) => {
            const updatedMessages = user.messages.map((message) =>
              message._id === messageId
                ? {
                    ...message,
                    isDeleted: true,
                    attachments: [],
                    text: "Tin nhắn đã thu hồi",
                  }
                : message
            );

            const lastMessage = updatedMessages[updatedMessages.length - 1];
            const sidebarText = lastMessage.isDeleted
              ? "Tin nhắn đã thu hồi"
              : lastMessage.text;

            return {
              ...user,
              newMessage: sidebarText,
              messages: updatedMessages,
            };
          });
        });
      });

      socket.on(
        "typing",
        ({ userId, typing }: { userId: string; typing: boolean }) => {
          setUsers((prevUsers) => {
            return prevUsers.map((user) => {
              if (user._id === userId) {
                return { ...user, typing };
              }
              return user;
            });
          });
        }
      );

      socket.on(
        "update-unread-count",
        ({ userId, unreadCount }: { userId: string; unreadCount: number }) => {
          queryClient.invalidateQueries({ queryKey: queryKeys.supportTicket.root });
          queryClient.invalidateQueries({ queryKey: queryKeys.chat.latest() });
          setUsers((prevUsers) => {
            return prevUsers.map((user) => {
              if (user._id === userId) {
                return { ...user, unreadCount };
              }

              return user;
            });
          });
        }
      );
    });

    return () => {
      socket?.disconnect();
    };
  }, [queryClient]);

  useEffect(() => {
    if (!latestData?.data) return;

    const mappedUsers: User[] = latestData.data.flatMap((msg) => {
      const messageUser = msg.userId;
      const userId = messageUser?._id;
      if (!userId) return [];

      const isFromCustomer = msg.sender === USER_ROLE.CUSTOMER;

      const initialUnreadCount = isFromCustomer ? msg.unreadCount || 0 : 0;

      const lastMessageText = msg.isDeleted
        ? "Tin nhắn đã thu hồi"
        : msg.text || "[Ảnh]";

      const fullName = messageUser.fullName?.trim() || "Ẩn danh";

      return [
        {
          _id: userId,
          fullName,
          avatarUrl: messageUser.avatarUrl,
          online: false,
          typing: false,
          newMessage: lastMessageText,
          unreadCount: initialUnreadCount,
          messages: [
            {
              _id: msg._id,
              text: msg.text,
              sender: msg.sender,
              roomId: msg.roomId,
              userId: { ...messageUser, fullName },
              isRead: msg.isRead,
              isDeleted: msg.isDeleted,
              createdAt: msg.createdAt,
              unreadCount: initialUnreadCount,
              attachments: msg.attachments || [],
            },
          ],
          time: new Date(msg.createdAt ?? Date.now()).toLocaleTimeString(),
        },
      ];
    });

    setUsers(mappedUsers);

    mappedUsers.forEach((user) =>
      socketRef.current?.emit("check-online", user._id)
    );
  }, [latestData?.data]);

  const handleSelectUser = (userId: string) => {
    setSelectedUser(userId);

    socketRef.current?.emit("join-room", `room-client-${userId}`);

    const selectedUserData = users.find((user) => user._id === userId);
    if (!selectedUserData) return;

    const unreadMessageIds = selectedUserData.messages
      .filter(
        (msg) => msg.sender === USER_ROLE.CUSTOMER && !msg.isRead && msg._id
      )
      .map((msg) => msg._id!);

    if (unreadMessageIds.length > 0) {
      socketRef.current?.emit("mark-as-read-bulk", {
        messageIds: unreadMessageIds,
        roomId: `room-client-${userId}`,
      });
    }

    setUsers((prevUsers) =>
      prevUsers.map((user) =>
        user._id === userId
          ? {
              ...user,
              unreadCount: 0,
              messages: user.messages.map((msg) => ({ ...msg, isRead: true })),
            }
          : user
      )
    );
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const messageText = event.target.value;
    setNewMessage(messageText);

    if (!selectedUser || !socketRef.current) return;

    socketRef.current.emit("typing", {
      typing: true,
      roomId: selectedRoomId,
      userId: selectedUser,
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit("typing", {
        userId: selectedUser,
        typing: false,
        roomId: selectedRoomId,
      });
    }, 1500);
  };

  const handleSendMessage = (attachments?: string[]) => {
    const messageText = newMessage.trim();
    const hasAttachments = attachments && attachments.length > 0;
    if (!messageText && !hasAttachments) return;

    if (!selectedUser || !socketRef.current) return;

    const messagePayload = {
      isRead: false,
      text: messageText,
      userId: selectedUser,
      roomId: selectedRoomId,
      sender: USER_ROLE.ADMIN,
      attachments: attachments || [],
      createdAt: new Date().toISOString(),
    };

    const optimisticMessage: Message = {
      ...messagePayload,
      _id: `optimistic-${messagePayload.createdAt}-${Math.random()
        .toString(36)
        .slice(2)}`,
      userId: {
        _id: selectedUser,
        fullName: selectedUserData?.fullName || "Ẩn danh",
        avatarUrl: selectedUserData?.avatarUrl,
      },
      isDeleted: false,
      unreadCount: 0,
    };

    setUsers((prevUsers) =>
      prevUsers.map((user) =>
        user._id === selectedUser
          ? {
              ...user,
              newMessage: getSidebarText(optimisticMessage),
              messages: [...user.messages, optimisticMessage],
              time: new Date(messagePayload.createdAt).toLocaleTimeString(),
            }
          : user
      )
    );

    socketRef.current.emit("send-message", messagePayload);
    setNewMessage("");
    socketRef.current.emit("typing", {
      typing: false,
      roomId: selectedRoomId,
      userId: selectedUser,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-normal">Chat khách hàng</h1>
      </div>
      <SupportTicketPanel />
      <div className="h-[calc(100vh-300px)] min-h-[520px] flex flex-col sm:flex-row p-2 sm:p-4 space-y-2 sm:space-y-0 border bg-white shadow-sm rounded-md overflow-hidden">
      <div
        className={cn(
          "flex-shrink-0 w-full sm:w-1/3 overflow-y-auto overflow-x-hidden transition-transform duration-200",
          selectedUser ? "hidden sm:block" : "block"
        )}
      >
        <Sidebar
          users={users}
          setUsers={setUsers}
          isPending={isPending}
          selectedUser={selectedUser}
          onSelectUser={handleSelectUser}
          setSelectedUser={setSelectedUser}
        />
      </div>

      <div
        className={cn(
          "flex-1 flex flex-col h-full min-h-0 min-w-0 overflow-hidden transition-transform duration-200",
          selectedUser ? "flex" : "hidden sm:flex"
        )}
      >
        {selectedUser && selectedUserData ? (
          <>
            <div className="block sm:hidden p-3 sm:p-4">
              <button
                onClick={() => setSelectedUser(null)}
                className="flex items-center gap-1 text-gray-600"
              >
                <ArrowLeft className="w-5 h-5" /> Trở lại
              </button>
            </div>

            <ChatHeader
              user={selectedUserData}
              ticket={selectedTicket}
              isResolving={isResolvingTicket}
              onResolve={() => resolveChatTicket(selectedRoomId)}
            />

            <StaffAiSummaryPanel
              summary={selectedTicket?.metadata?.assistantHandoffSummary}
            />

            <div
              id={`admin-chat-transcript-${selectedRoomId}`}
              tabIndex={-1}
              className="flex flex-1 min-h-0 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChatMessages
                setUsers={setUsers}
                socket={socketRef.current!}
                selectedUser={selectedUser}
                selectedRoomId={selectedRoomId}
                typing={selectedUserData?.typing}
                userName={selectedUserData.fullName || "Ẩn danh"}
                messages={selectedUserData?.messages || []}
              />
            </div>

            <ChatInput
              value={newMessage}
              onSend={handleSendMessage}
              onChange={handleInputChange}
            />
          </>
        ) : (
          <div className="flex-1 h-full flex flex-col items-center justify-center gap-3 p-4 text-center">
            <h3 className="text-xl font-bold">Chọn cuộc trò chuyện</h3>
            <p className="text-muted-foreground">
              Chọn một khách hàng từ danh sách để bắt đầu trò chuyện
            </p>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};
