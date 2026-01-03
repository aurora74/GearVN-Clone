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

import { ArrowUp, Edit, MoreVertical, Trash } from "lucide-react";

import { User } from "@/types/user";
import { Message } from "@/types/chat";

import { cn } from "@/utils/cn";
import { formatDateVi } from "@/utils/format/format-date-vi";
import { formatShortName } from "@/utils/format/format-short-name";
import { formatDateTimeVi } from "@/utils/format/format-date-time-vi";

import { USER_ROLE } from "@/config.global";
import { useMessagesByRoom } from "@/react-query/query/chat";
import { DEFAULT_MESSAGE_CHAT } from "@/constants/chat/default-message-chat";

import { MessageSkeleton } from "./message-skeleton";

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
  messages: Message[];
  socketRef: RefObject<any>;
  setMessages: Dispatch<SetStateAction<Message[]>>;
  setUnreadCount: Dispatch<SetStateAction<number>>;
};

export const ChatBody = ({
  user,
  roomId,
  messages,
  isTyping,
  socketRef,
  setMessages,
  setUnreadCount,
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
        (m) => !existingIds.has(m._id)
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
  }, [messages, isTyping, page]);

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
          : msg
      )
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
          : msg
      )
    );
  };

  return (
    <div
      ref={chatBodyRef}
      className="flex-1 p-4 bg-gray-50 overflow-y-auto custom-scroll"
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
              <div className="size-8 flex-shrink-0 rounded-full overflow-hidden">
                <Image
                  width={100}
                  height={100}
                  alt="Avatar"
                  src="/avatar-default.jpg"
                />
              </div>
              <div className="max-w-xs flex flex-col items-start mx-2 text-[12px]">
                <p className="text-gray-500 mb-1">GearVN</p>
                <div className="text-sm text-gray-900 p-2 border bg-white shadow-sm rounded-lg">
                  {DEFAULT_MESSAGE_CHAT.text}
                </div>
                <span className="text-[10px] text-gray-400 mt-1">
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
                      ? "max-w-[280px] flex-row-reverse ml-auto"
                      : "max-w-full flex-row"
                  )}
                >
                  <div className="size-8 flex-shrink-0 rounded-full overflow-hidden">
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
                      "max-w-xs flex flex-col text-[12px] mx-2",
                      isClient ? "items-end" : "items-start"
                    )}
                  >
                    <p className="text-gray-500 mb-1">
                      {isClient
                        ? formatShortName(user?.fullName || "")
                        : "GearVN"}
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
                            "relative group text-sm p-2 border rounded-lg shadow-sm break-words",
                            isClient
                              ? message.isDeleted
                                ? "text-gray-500 italic bg-gray-200"
                                : "text-white bg-primary"
                              : message.isDeleted
                              ? "text-gray-400 italic bg-gray-100"
                              : "text-gray-900 bg-white"
                          )}
                        >
                          {message.isDeleted
                            ? "Tin nhắn đã thu hồi"
                            : message.text}

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
                          isClient ? "justify-end" : "justify-start"
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

      {isTyping && (
        <p className="absolute left-0 bottom-[70px] sm:bottom-[53px] w-full text-[13px] text-muted-foreground py-1 px-4 bg-white italic mt-2">
          GearVN Đang soạn tin...
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
