import Image from "next/image";
import { Dispatch, SetStateAction } from "react";

import { X } from "lucide-react";

type ChatPreviewProps = {
  previews: string[];
  uploadedUrls: string[];
  setPreviews: Dispatch<SetStateAction<string[]>>;
  setUploadedUrls: Dispatch<SetStateAction<string[]>>;
};

export const ChatPreview = ({
  previews,
  setPreviews,
  uploadedUrls,
  setUploadedUrls,
}: ChatPreviewProps) => {
  const removePreview = (index: number) => {
    const newPreviews = [...previews];
    const newUrls = [...uploadedUrls];

    newUrls.splice(index, 1);
    newPreviews.splice(index, 1);

    setPreviews(newPreviews);
    setUploadedUrls(newUrls);
  };

  return (
    previews.length > 0 && (
      <div className="flex gap-2 p-2 border-t bg-gray-50 overflow-x-auto custom-scroll">
        {previews.map((url, idx) => (
          <div
            key={idx}
            className="relative size-20 rounded-lg overflow-hidden"
          >
            <Image src={url} alt="preview" fill className="object-cover" />

            <button
              type="button"
              onClick={() => removePreview(idx)}
              className="absolute top-1 right-1 p-0.5 bg-white/80 hover:bg-white rounded-full shadow cursor-pointer z-10"
            >
              <X className="size-3.5 text-gray-700" />
            </button>
          </div>
        ))}
      </div>
    )
  );
};
