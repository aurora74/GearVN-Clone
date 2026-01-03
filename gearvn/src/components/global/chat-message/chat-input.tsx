import Image from "next/image";
import { RefObject, useRef, useState } from "react";

import { Socket } from "socket.io-client";
import { Loader, Paperclip, Send, X } from "lucide-react";

import { cn } from "@/utils/cn";
import { User } from "@/types/user";
import { useAuthModal } from "@/stores/use-auth-modal";
import { useUpload } from "@/react-query/mutation/chat";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Attachment = {
  file: File;
  url?: string;
  preview: string;
  uploading: boolean;
};

type ChatInputProps = {
  roomId: string;
  user: User | null;
  socketRef: RefObject<Socket | null>;
};

export const ChatInput = ({ user, roomId, socketRef }: ChatInputProps) => {
  const { setModal } = useAuthModal();

  const { mutateAsync: uploadFiles } = useUpload();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const sendMessage = () => {
    if (!user) {
      setModal("login");
      return;
    }

    if ((!text.trim() && attachments.length === 0) || !socketRef.current)
      return;

    socketRef.current.emit("send-message", {
      text,
      roomId,
      isRead: false,
      userId: user._id,
      sender: "CUSTOMER",
      createdAt: new Date().toISOString(),
      attachments: attachments
        .map((att) => att.url)
        .filter(Boolean) as string[],
    });

    setText("");
    setAttachments([]);
    socketRef.current.emit("typing", {
      roomId,
      typing: false,
      userId: user._id,
      from: "CUSTOMER",
    });
  };

  const handleTyping = (value: string) => {
    setText(value);
    if (!socketRef.current || !user) return;

    socketRef.current.emit("typing", {
      roomId,
      typing: true,
      userId: user._id,
      from: "CUSTOMER",
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit("typing", {
        roomId,
        typing: false,
        userId: user._id,
        from: "CUSTOMER",
      });
    }, 1000);
  };

  const handleFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const selectedFiles = Array.from(e.target.files);
    const newAttachments: Attachment[] = selectedFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      uploading: true,
    }));

    setAttachments((prev) => [...prev, ...newAttachments]);

    try {
      const uploadedUrls = await uploadFiles(selectedFiles);

      setAttachments((prev) =>
        prev.map((att) => {
          const index = selectedFiles.findIndex((f) => f === att.file);
          return index !== -1
            ? { ...att, url: uploadedUrls[index], uploading: false }
            : att;
        })
      );
    } catch {
      setAttachments((prev) =>
        prev.map((att) =>
          selectedFiles.includes(att.file) ? { ...att, uploading: false } : att
        )
      );
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prevAttachments) =>
      prevAttachments.filter((_, i) => i !== index)
    );
  };

  return (
    <div className="flex flex-col gap-2 p-2 border-t">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((att, idx) => (
            <div
              key={idx}
              className="w-20 h-20 relative border rounded overflow-hidden"
            >
              <Image
                fill
                unoptimized
                alt="preview"
                src={att.preview}
                className="object-contain"
              />

              {att.uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <Loader className="size-5 text-white animate-spin" />
                </div>
              )}

              <button
                type="button"
                onClick={() => removeAttachment(idx)}
                className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 rounded-full p-1 cursor-pointer transition-colors"
              >
                <X size={16} className="text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          multiple
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFilesChange}
        />

        <Button variant="ghost" onClick={() => fileInputRef.current?.click()}>
          <Paperclip size={16} />
        </Button>

        <Input
          value={text}
          placeholder="Nhập tin nhắn..."
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          onChange={(e) => handleTyping(e.target.value)}
          className="flex-1 text-sm"
        />

        <Button
          onClick={sendMessage}
          disabled={
            (!text.trim() && attachments.length === 0) ||
            attachments.some((a) => a.uploading)
          }
          className={cn(
            "text-white bg-primary hover:bg-primary/80",
            (!text.trim() && attachments.length === 0) ||
              (attachments.some((a) => a.uploading) &&
                "opacity-50 cursor-not-allowed")
          )}
        >
          <Send size={16} />
        </Button>
      </div>
    </div>
  );
};
