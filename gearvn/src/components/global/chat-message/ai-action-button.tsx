import { RefObject, useState } from "react";

import { Socket } from "socket.io-client";

import { AssistantActionDraft } from "@/types/chat";
import { cn } from "@/utils/cn";

type OptimisticMessagePayload = {
  text: string;
  attachments: string[];
  createdAt: string;
};

type AiActionButtonProps = {
  draft: AssistantActionDraft;
  roomId: string;
  socketRef: RefObject<Socket | null>;
  pendingDraftId?: string | null;
  onOptimisticMessage?: (message: OptimisticMessagePayload) => void;
  onPendingDraftChange?: (draftId: string | null) => void;
};

const actionLabels: Record<string, string> = {
  CART_ADD: "Thêm vào giỏ",
  CART_REMOVE: "Xóa khỏi giỏ",
  CART_SET_QUANTITY: "Cập nhật số lượng",
  APPLY_VOUCHER: "Áp dụng voucher",
  CHECKOUT_REDIRECT: "Đi tới thanh toán",
  CHECKOUT_PREP: "Đi tới thanh toán",
};

const getActionKind = (draft: AssistantActionDraft) => draft.action ?? draft.kind;


export const AiActionButton = ({
  draft,
  roomId,
  socketRef,
  pendingDraftId,
  onOptimisticMessage,
  onPendingDraftChange,
}: AiActionButtonProps) => {
  const [isCancelled, setIsCancelled] = useState(false);
  const actionKind = getActionKind(draft);
  const label = actionLabels[actionKind] ?? draft.displayText;
  const isDestructive = actionKind === "CART_REMOVE";
  const isPending = pendingDraftId === draft.draftId;
  const isDisabled = isPending || isCancelled;

  const confirmAction = () => {
    if (!socketRef.current || isDisabled) return;

    const displayText = label || draft.displayText;
    socketRef.current.emit("assistant-confirm-action", {
      roomId,
      draftId: draft.draftId,
      displayText,
    });
    onOptimisticMessage?.({
      text: displayText,
      attachments: [],
      createdAt: new Date().toISOString(),
    });
    onPendingDraftChange?.(draft.draftId);
  };

  return (
    <div className="flex w-full flex-wrap gap-2 rounded-md border border-gray-200 bg-gray-50 p-2">
      <button
        type="button"
        disabled={isDisabled}
        onClick={confirmAction}
        className={cn(
          "inline-flex min-h-11 flex-1 items-center justify-center rounded-md px-3 text-xs font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-wait disabled:opacity-70",
          isDestructive
            ? "bg-red-600 hover:bg-red-700 focus-visible:ring-red-500"
            : "bg-primary hover:bg-primary/90 focus-visible:ring-primary"
        )}
      >
        {label}
      </button>
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => setIsCancelled(true)}
        className="inline-flex min-h-11 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-70"
      >
        Hủy
      </button>
    </div>
  );
};
