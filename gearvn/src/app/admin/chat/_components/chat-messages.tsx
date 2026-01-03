"use client";

import {
  useRef,
  useState,
  Dispatch,
  useEffect,
  SetStateAction,
  useLayoutEffect,
} from "react";
import Image from "next/image";

import { Socket } from "socket.io-client";
import { ArrowUp, Edit, Loader, MoreVertical, Trash } from "lucide-react";

import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Slideshow from "yet-another-react-lightbox/plugins/slideshow";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";

import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";

import {
  scrollToBottom,
  isUserNearBottom,
  mergeAndSortMessages,
} from "@/utils/messages";
import { cn } from "@/utils/cn";
import { formatDateTimeVi } from "@/utils/format/format-date-time-vi";

import { Message, User } from "@/types/chat";
import { useMessagesByRoom } from "@/react-query/query/chat";

import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type ChatMessagesProps = {
  socket: Socket;
  typing: boolean;
  userName: string;
  messages: Message[];
  selectedUser: string;
  selectedRoomId: string;
  setUsers: Dispatch<SetStateAction<User[]>>;
};

export const ChatMessages = ({
  typing,
  socket,
  setUsers,
  userName,
  selectedUser,
  selectedRoomId,
  messages: initialMessages,
}: ChatMessagesProps) => {
  const [page, setPage] = useState(1);

  const { data: messagesRoom, isPending } = useMessagesByRoom(selectedRoomId, {
    page,
    limit: 10,
    sortBy: "-createdAt",
  });

  const isInitialRoomLoadRef = useRef(true);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [editingText, setEditingText] = useState("");
  const [previewIndex, setPreviewIndex] = useState(0);

  const [hasMore, setHasMore] = useState(true);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [previewAttachments, setPreviewAttachments] = useState<string[]>([]);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
    setMessages([]);
    isInitialRoomLoadRef.current = true;
  }, [selectedRoomId]);

  useLayoutEffect(() => {
    if (!messagesRoom?.data || !selectedUser) return;

    const container = containerRef.current;
    const previousScrollHeight = container?.scrollHeight || 0;

    setMessages((prevMessages) =>
      mergeAndSortMessages(prevMessages, messagesRoom.data)
    );

    setUsers((prevUsers) =>
      prevUsers.map((user) =>
        user._id === selectedUser
          ? {
              ...user,
              messages: mergeAndSortMessages(
                messagesRoom.data,
                user.messages || []
              ),
            }
          : user
      )
    );

    requestAnimationFrame(() => {
      if (isInitialRoomLoadRef.current || page === 1) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        isInitialRoomLoadRef.current = false;
      } else if (container) {
        const newScrollHeight = container.scrollHeight;
        container.scrollTop = newScrollHeight - previousScrollHeight;
      }
    });

    setHasMore(messagesRoom.page < messagesRoom.totalPages);
  }, [messagesRoom, selectedUser, setUsers, page]);

  useLayoutEffect(() => {
    if (messages.length === 0) return;

    const container = containerRef.current;
    if (!container) return;

    if (isInitialRoomLoadRef.current || isUserNearBottom(container, 120)) {
      scrollToBottom(container);
      isInitialRoomLoadRef.current = false;
    }
  }, [messages]);

  useEffect(() => {
    if (!initialMessages?.length) return;

    const container = containerRef.current;
    setMessages((prevMessages) =>
      mergeAndSortMessages(prevMessages, initialMessages)
    );

    if (!container) return;
    if (isInitialRoomLoadRef.current || isUserNearBottom(container, 200)) {
      scrollToBottom(container);
      isInitialRoomLoadRef.current = false;
    }
  }, [initialMessages]);

  useEffect(() => {
    const handleMessageEdited = (editedMessage: Message) => {
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg._id === editedMessage._id ? { ...msg, ...editedMessage } : msg
        )
      );
    };

    const handleMessageDeleted = (payload: { messageId: string }) => {
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg._id === payload.messageId
            ? {
                ...msg,
                isDeleted: true,
                text: "Tin nhắn đã thu hồi",
                attachments: [],
              }
            : msg
        )
      );
    };

    socket.on("message-edited", handleMessageEdited);
    socket.on("message-deleted", handleMessageDeleted);

    return () => {
      socket.off("message-edited", handleMessageEdited);
      socket.off("message-deleted", handleMessageDeleted);
    };
  }, [socket]);

  useEffect(() => {
    if (editingMessageId) inputRef.current?.focus();
  }, [editingMessageId]);

  const handleEditClick = (message: Message) => {
    setEditingMessageId(message._id!);
    setEditingText(message.text || "");
  };

  const handleEditSubmit = () => {
    if (editingMessageId && editingText.trim()) {
      socket.emit("edit-message", {
        messageId: editingMessageId,
        roomId: selectedRoomId,
        newText: editingText.trim(),
      });
    }

    setEditingMessageId(null);
    setEditingText("");
  };

  const handleConfirmDelete = (messageId: string) => {
    socket.emit("delete-message", { messageId, roomId: selectedRoomId });

    setMessages((prevMessages) =>
      prevMessages.map((msg) =>
        msg._id === messageId
          ? {
              ...msg,
              isDeleted: true,
              text: "Tin nhắn đã thu hồi",
              attachments: [],
            }
          : msg
      )
    );

    setConfirmDeleteId(null);
  };

  const handleLoadMore = () => setPage((currentPage) => currentPage + 1);

  const handleDeleteClick = (message: Message) => {
    if (message._id) setConfirmDeleteId(message._id);
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex-1 h-[calc(100vh-270px)] sm:h-[calc(100vh-230px)] p-4 space-y-4 custom-scroll",
        isPending ? "overflow-hidden" : "overflow-y-auto"
      )}
    >
      {hasMore && (
        <div className="flex justify-center mb-6">
          <Button
            size="sm"
            onClick={handleLoadMore}
            className="flex items-center gap-2 text-gray-700 bg-gray-200 hover:bg-gray-300"
          >
            <ArrowUp className="size-4" /> Xem tin nhắn cũ
          </Button>
        </div>
      )}

      {isPending ? (
        <div className="h-full flex flex-col items-center justify-center gap-2">
          <Loader className="size-7 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Đang tải tin nhắn...</p>
        </div>
      ) : (
        messages.map((msg) => {
          const attachments = msg.attachments ?? [];

          const isAdmin = msg.sender === "ADMIN";
          const isEditing = msg._id === editingMessageId;
          const isConfirmDelete = msg._id === confirmDeleteId;

          return (
            <div
              key={msg._id}
              className={cn("flex", isAdmin ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "w-full max-w-full sm:max-w-[50%] flex flex-col gap-2",
                  isAdmin && "ml-auto"
                )}
              >
                {isConfirmDelete ? (
                  <div className="flex gap-2 p-2 border border-red-300 bg-red-50 rounded-lg">
                    <Input
                      readOnly
                      value={msg.text}
                      className="flex-1 text-sm bg-white cursor-not-allowed"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleConfirmDelete(msg._id!)}
                      className="bg-primary text-white hover:bg-primary"
                    >
                      Thu hồi
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setConfirmDeleteId(null)}
                      className="bg-gray-300 text-gray-700 hover:bg-gray-300/80"
                    >
                      Hủy
                    </Button>
                  </div>
                ) : (
                  <>
                    <div
                      className={cn(
                        "w-fit relative group pl-2.5 pr-4 py-2 rounded-lg",
                        isAdmin
                          ? isEditing
                            ? "!w-full bg-white"
                            : msg.isDeleted
                            ? "text-gray-500 bg-gray-200 italic ml-auto"
                            : "text-white bg-primary ml-auto"
                          : msg.isDeleted
                          ? "text-gray-400 bg-gray-100 italic"
                          : "text-gray-900 border border-gray-200 bg-white"
                      )}
                    >
                      {isAdmin && !isEditing && !msg.isDeleted && (
                        <div className="absolute top-1 -left-8 sm:-left-16 flex gap-1">
                          <div className="hidden sm:flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleEditClick(msg)}
                              className="text-primary p-1 cursor-pointer"
                            >
                              <Edit width={18} height={18} />
                            </button>

                            <button
                              onClick={() => handleDeleteClick(msg)}
                              className="text-primary p-1 cursor-pointer"
                            >
                              <Trash width={18} height={18} />
                            </button>
                          </div>

                          <div className="sm:hidden">
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className="p-1 text-gray-600">
                                  <MoreVertical width={18} height={18} />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-32 p-2 flex flex-col space-y-1">
                                <button
                                  onClick={() => handleEditClick(msg)}
                                  className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded"
                                >
                                  <Edit width={16} height={16} /> Sửa
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(msg)}
                                  className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded text-red-600"
                                >
                                  <Trash width={16} height={16} /> Xóa
                                </button>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                      )}

                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <Input
                            ref={inputRef}
                            value={editingText}
                            onKeyDown={(e) =>
                              e.key === "Enter" && handleEditSubmit()
                            }
                            onChange={(e) => setEditingText(e.target.value)}
                            className="flex-1 text-sm p-2 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary rounded"
                          />
                          <Button
                            size="sm"
                            onClick={handleEditSubmit}
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
                      ) : (
                        <p className="text-sm break-words whitespace-pre-wrap">
                          {msg.isDeleted ? "Tin nhắn đã thu hồi" : msg.text}
                        </p>
                      )}

                      {msg.createdAt && (
                        <p
                          className={cn(
                            "flex items-center gap-1 text-xs mt-1",
                            isAdmin
                              ? isEditing
                                ? "text-gray-500"
                                : msg.isDeleted
                                ? "text-gray-500"
                                : "text-white/80"
                              : "text-gray-500"
                          )}
                        >
                          {formatDateTimeVi(new Date(msg.createdAt))}
                        </p>
                      )}
                    </div>

                    {!msg.isDeleted && attachments.length > 0 && (
                      <div
                        className={cn(
                          "flex flex-wrap gap-2 w-fit",
                          isAdmin ? "ml-auto justify-end" : "justify-start"
                        )}
                      >
                        {attachments.slice(0, 3).map((url, i) => {
                          const remaining = attachments.length - 3;

                          return (
                            <div
                              key={i}
                              onClick={() => {
                                setPreviewIndex(i);
                                setIsPreviewOpen(true);
                                setPreviewAttachments(msg.attachments || []);
                              }}
                              className="relative size-28 border bg-white cursor-pointer rounded-md overflow-hidden"
                            >
                              <Image
                                fill
                                src={url}
                                alt={`attachment-${i}`}
                                className={
                                  i === 2 && remaining > 0
                                    ? "object-contain brightness-50"
                                    : "object-contain"
                                }
                              />

                              {i === 2 && remaining > 0 && (
                                <div className="absolute inset-0 flex items-center justify-center text-xl font-bold text-white">
                                  +{remaining}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })
      )}

      {typing && (
        <p className="absolute bottom-[70px] sm:bottom-[60px] text-[13px] text-muted-foreground py-2 bg-white italic mt-2">
          {userName} đang soạn tin...
        </p>
      )}

      <div ref={messagesEndRef} />

      <Lightbox
        open={isPreviewOpen}
        index={previewIndex}
        close={() => setIsPreviewOpen(false)}
        plugins={[Zoom, Fullscreen, Slideshow, Thumbnails]}
        slides={previewAttachments.map((url) => ({ src: url }))}
      />
    </div>
  );
};
