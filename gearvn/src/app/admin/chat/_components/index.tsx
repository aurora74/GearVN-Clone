"use client";

import { useState, useEffect, useRef } from "react";

import { useQueryState } from "nuqs";
import { ArrowLeft } from "lucide-react";
import { io, Socket } from "socket.io-client";

import { cn } from "@/utils/cn";
import { USER_ROLE } from "@/config.global";
import { User, Message } from "@/types/chat";
import { useLatestMessages } from "@/react-query/query/chat";

import { Sidebar } from "./sidebar";
import { ChatInput } from "./chat-input";
import { ChatHeader } from "./chat-header";
import { ChatMessages } from "./chat-messages";

export const ChatPage = () => {
  const [search] = useQueryState("search", { shallow: false, history: "push" });

  const { data: latestData, isPending } = useLatestMessages({
    page: 1,
    limit: 20,
    ...(search ? { search } : {}),
  });

  const [users, setUsers] = useState<User[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const selectedUserRef = useRef<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const selectedUserData = users.find((u) => u._id === selectedUser);
  const selectedRoomId = selectedUser ? `room-client-${selectedUser}` : "";

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  useEffect(() => {
    const fetchSocketUrl = async () => {
      const response = await fetch("/api/chat/socket/connect");
      const { url } = await response.json();
      return url;
    };

    fetchSocketUrl().then((socketUrl) => {
      const socket: Socket = io(socketUrl, {
        query: { role: USER_ROLE.ADMIN },
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
        const userId = msg.userId._id;
        if (!userId) return;

        setUsers((prevUsers) => {
          return prevUsers.map((user) => {
            if (user._id !== userId) return user;

            const incomingMessage: Message = { ...msg };
            const isRoomCurrentlyOpen = selectedUserRef.current === userId;
            const isMessageFromCustomer = msg.sender === USER_ROLE.CUSTOMER;

            if (isRoomCurrentlyOpen && isMessageFromCustomer) {
              incomingMessage.isRead = true;
              socketRef.current?.emit("mark-as-read-bulk", {
                messageIds: [msg._id],
                roomId: msg.roomId,
              });
            }

            let updatedUnreadCount: number;
            if (isMessageFromCustomer) {
              if (isRoomCurrentlyOpen) {
                updatedUnreadCount = 0;
              } else {
                updatedUnreadCount = msg.unreadCount;
              }
            } else {
              updatedUnreadCount = user.unreadCount;
            }

            const sidebarText =
              incomingMessage.isDeleted && isMessageFromCustomer
                ? "Tin nhắn đã thu hồi"
                : incomingMessage.text;

            return {
              ...user,
              online: true,
              typing: false,
              newMessage: sidebarText,
              unreadCount: updatedUnreadCount,
              messages: [...user.messages, incomingMessage],
              time: new Date(msg.createdAt ?? Date.now()).toLocaleTimeString(),
            };
          });
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

      return () => {
        socket.disconnect();
      };
    });
  }, []);

  useEffect(() => {
    if (!latestData?.data) return;

    const mappedUsers: User[] = latestData.data.map((msg) => {
      const isFromCustomer = msg.sender === USER_ROLE.CUSTOMER;

      const initialUnreadCount = isFromCustomer ? msg.unreadCount || 0 : 0;

      const lastMessageText = msg.isDeleted
        ? "Tin nhắn đã thu hồi"
        : msg.text || "[Ảnh]";

      return {
        _id: msg.userId._id,
        fullName: msg.userId.fullName,
        avatarUrl: msg.userId.avatarUrl,
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
            userId: msg.userId,
            isRead: msg.isRead,
            isDeleted: msg.isDeleted,
            createdAt: msg.createdAt,
            unreadCount: initialUnreadCount,
            attachments: msg.attachments || [],
          },
        ],
        time: new Date(msg.createdAt ?? Date.now()).toLocaleTimeString(),
      };
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
      from: USER_ROLE.ADMIN,
      roomId: selectedRoomId,
      userId: USER_ROLE.ADMIN,
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit("typing", {
        from: USER_ROLE.ADMIN,
        userId: USER_ROLE.ADMIN,
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

    socketRef.current.emit("send-message", messagePayload);
    setNewMessage("");
    socketRef.current.emit("typing", {
      typing: false,
      from: USER_ROLE.ADMIN,
      roomId: selectedRoomId,
      userId: USER_ROLE.ADMIN,
    });
  };

  return (
    <div className="h-[calc(100vh-68px)] flex flex-col sm:flex-row p-2 sm:p-4 space-y-2 sm:space-y-0 border bg-white shadow-sm rounded-md">
      <div
        className={cn(
          "flex-shrink-0 w-full sm:w-1/3 overflow-auto transition-transform duration-200",
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
          "flex-1 flex flex-col h-full min-h-0 transition-transform duration-200",
          selectedUser ? "block" : "hidden sm:flex"
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

            <ChatHeader user={selectedUserData} />

            <ChatMessages
              setUsers={setUsers}
              socket={socketRef.current!}
              selectedUser={selectedUser}
              selectedRoomId={selectedRoomId}
              typing={selectedUserData?.typing}
              userName={selectedUserData?.fullName}
              messages={selectedUserData?.messages || []}
            />

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
  );
};
