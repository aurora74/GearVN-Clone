import Image from "next/image";

import { X } from "lucide-react";

import { AssistantMode } from "@/types/chat";

export const ChatHeader = ({
  assistantMode,
  onClose,
}: {
  assistantMode: AssistantMode;
  onClose: () => void;
}) => {
  const subtitle =
    assistantMode === "staff" ? "Nhân viên đang hỗ trợ" : "AI đang tư vấn";

  return (
    <div className="flex items-center justify-between bg-primary p-5 text-white sm:rounded-t-xl">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white">
          <Image
            width={32}
            height={32}
            alt="Avatar"
            src="/avatar-default.jpg"
          />
        </div>

        <div className="min-w-0">
          <h3 className="text-lg font-semibold leading-tight">GearVN AI</h3>
          <p className="text-sm leading-snug opacity-90">{subtitle}</p>
        </div>
      </div>

      <button
        type="button"
        aria-label="Đóng chat"
        onClick={onClose}
        className="cursor-pointer rounded p-2 hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
      >
        <X className="size-5" />
      </button>
    </div>
  );
};
