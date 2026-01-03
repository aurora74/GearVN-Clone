"use client";

import Image from "next/image";
import { useState, useEffect, useCallback } from "react";

import { Send, Paperclip, X, Loader } from "lucide-react";

import { cn } from "@/utils/cn";
import { revokePreview } from "@/utils/messages";
import { useUpload } from "@/react-query/mutation/chat";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type Attachment = {
  file: File;
  url?: string;
  preview: string;
  uploading: boolean;
};

type ChatInputProps = {
  value: string;
  onSend: (attachments?: string[]) => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export const ChatInput = ({ value, onChange, onSend }: ChatInputProps) => {
  const { mutateAsync: uploadFiles } = useUpload();

  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const isUploading = attachments.some((attachment) => attachment.uploading);

  const uploadedCount = attachments.filter(
    (attachment) => attachment.url
  ).length;

  useEffect(
    () => () => attachments.forEach((a) => URL.revokeObjectURL(a.preview)),
    [attachments]
  );

  const handleFiles = useCallback(
    async (fileList: FileList) => {
      const filesArray = Array.from(fileList);
      const newAttachments: Attachment[] = filesArray.map((file) => ({
        file,
        uploading: true,
        preview: URL.createObjectURL(file),
      }));

      setAttachments((prev) => [...prev, ...newAttachments]);

      try {
        const uploadedUrls = await uploadFiles(filesArray);

        setAttachments((prevAttachments) =>
          prevAttachments.map((attachment) => {
            const fileIndex = filesArray.findIndex(
              (file) => file === attachment.file
            );

            return fileIndex !== -1
              ? {
                  ...attachment,
                  url: uploadedUrls[fileIndex],
                  uploading: false,
                }
              : attachment;
          })
        );
      } catch {
        setAttachments((prev) => {
          prev.forEach((att) => {
            if (filesArray.includes(att.file)) revokePreview(att.preview);
          });
          return prev.filter((att) => !filesArray.includes(att.file));
        });
      }
    },
    [uploadFiles]
  );

  const handleSend = useCallback(() => {
    const uploadedUrls =
      attachments
        .filter((attachment) => attachment.url)
        .map((attachment) => attachment.url!) ?? [];

    if (!value.trim() && uploadedUrls.length === 0) return;

    onSend(uploadedUrls);
    attachments.forEach((attachment) => revokePreview(attachment.preview));
    setAttachments([]);
  }, [attachments, value, onSend]);

  const removeAttachment = useCallback((previewUrl: string) => {
    setAttachments((prevAttachments) => {
      revokePreview(previewUrl);
      return prevAttachments.filter(
        (attachment) => attachment.preview !== previewUrl
      );
    });
  }, []);

  return (
    <div className="flex-1 relative pt-4 pl-4 border-t bg-white">
      {attachments.length > 0 && (
        <div className="flex absolute bottom-full space-x-2 mb-2 overflow-x-auto custom-scroll">
          {attachments.map((att) => (
            <div key={att.preview} className="relative size-20">
              <Image
                fill
                src={att.preview}
                alt="Ảnh đính kèm"
                className="border object-contain rounded-md"
              />

              {att.uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-md">
                  <Loader className="size-5 text-white animate-spin" />
                </div>
              )}

              <button
                type="button"
                aria-label="Xoá ảnh"
                onClick={() => removeAttachment(att.preview)}
                className="absolute top-1 right-1 p-0.5 bg-white/80 hover:bg-white shadow rounded-full cursor-pointer z-10"
              >
                <X className="size-3.5 text-gray-700" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <label htmlFor="file-upload" className="cursor-pointer">
          <Paperclip className="size-5 text-gray-500 hover:text-gray-700" />
        </label>
        <input
          multiple
          type="file"
          accept="image/*"
          id="file-upload"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />

        <Input
          type="text"
          value={value}
          onChange={onChange}
          placeholder="Nhập tin nhắn..."
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          className="flex-1"
        />

        <Button
          onClick={handleSend}
          aria-label="Gửi tin nhắn"
          disabled={(!value.trim() && uploadedCount === 0) || isUploading}
          className={cn(
            "flex items-center justify-center",
            (!value.trim() && uploadedCount === 0) || isUploading
              ? "bg-gray-300 cursor-not-allowed"
              : "text-white bg-primary hover:bg-primary/90"
          )}
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
};
