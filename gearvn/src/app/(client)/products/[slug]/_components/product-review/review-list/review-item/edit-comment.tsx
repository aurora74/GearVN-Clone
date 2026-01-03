import Image from "next/image";
import { ChangeEvent, useState } from "react";

import { Icon } from "@iconify/react";
import { Loader, X } from "lucide-react";

import { cn } from "@/utils/cn";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type EditCommentFormProps = {
  isSaving: boolean;
  commentId: string;
  onCancel: () => void;
  initialContent: string;
  initialImages: (File | string)[];
  onSave: (content: string, images: (File | string)[]) => void;
};

export const EditCommentForm = ({
  onSave,
  isSaving,
  onCancel,
  commentId,
  initialImages,
  initialContent,
}: EditCommentFormProps) => {
  const [content, setContent] = useState(initialContent);
  const [images, setImages] = useState<(File | string)[]>(initialImages);

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setImages((prev) => [...prev, ...Array.from(files as FileList)]);
    e.target.value = "";
  };

  const removeImage = (index: number) =>
    setImages((prev) => prev.filter((_, i) => i !== index));

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <label
          htmlFor={`file-input-${commentId}`}
          className={cn(
            "text-gray-500 hover:text-gray-700 mt-2 cursor-pointer",
            isSaving && "pointer-events-none opacity-50"
          )}
        >
          <Icon icon="material-symbols:add-a-photo" fontSize={22} />
        </label>

        <Textarea
          value={content}
          disabled={isSaving}
          placeholder="Chỉnh sửa nội dung..."
          onChange={(e) => setContent(e.target.value)}
          className="w-full border rounded-md p-2"
        />
      </div>

      <input
        multiple
        type="file"
        accept="image/*"
        className="hidden"
        disabled={isSaving}
        onChange={handleImageChange}
        id={`file-input-${commentId}`}
      />

      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {images.map((img, idx) => {
            const src =
              typeof img === "string" ? img : URL.createObjectURL(img);

            return (
              <div key={idx} className="relative size-28">
                <Image fill alt="Ảnh" src={src} className="object-contain" />
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => removeImage(idx)}
                  className={cn(
                    "absolute top-1 right-1 text-white p-1 bg-primary hover:bg-primary/70 rounded-full",
                    isSaving && "pointer-events-none opacity-50"
                  )}
                >
                  <X size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-end gap-2 mt-2">
        <Button
          type="button"
          disabled={isSaving}
          onClick={() => onSave(content, images)}
        >
          {isSaving && <Loader className="size-4 animate-spin mr-1" />}
          Lưu
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSaving}
        >
          Hủy
        </Button>
      </div>
    </div>
  );
};
