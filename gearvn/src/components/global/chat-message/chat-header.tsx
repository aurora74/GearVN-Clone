import Image from "next/image";

import { X } from "lucide-react";

export const ChatHeader = ({ onClose }: { onClose: () => void }) => {
  return (
    <div className="flex justify-between items-center p-4 text-white bg-primary rounded-t-lg">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center size-8 bg-white rounded-full overflow-hidden">
          <Image
            width={32}
            height={32}
            alt="Avatar"
            src="/avatar-default.jpg"
          />
        </div>

        <div>
          <h3 className="text-sm font-semibold">GearVN</h3>
          <p className="text-xs opacity-90">Chat với chúng tôi</p>
        </div>
      </div>

      <button
        onClick={onClose}
        className="p-2 hover:bg-red-700 rounded cursor-pointer"
      >
        <X className="size-5" />
      </button>
    </div>
  );
};
