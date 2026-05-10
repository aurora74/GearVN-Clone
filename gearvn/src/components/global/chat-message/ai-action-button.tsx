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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getDraftPayload = (draft: AssistantActionDraft) =>
  isRecord(draft.payload) ? draft.payload : {};

const coerceCheckoutDetails = (
  value: unknown,
): AssistantActionDraft["checkout"] => {
  if (!isRecord(value)) return undefined;

  const checkout: AssistantActionDraft["checkout"] = {};
  if (typeof value.name === "string") checkout.name = value.name;
  if (typeof value.phone === "string") checkout.phone = value.phone;
  if (typeof value.address === "string") checkout.address = value.address;

  return Object.keys(checkout).length ? checkout : undefined;
};

const getDraftCheckout = (
  draft: AssistantActionDraft,
): AssistantActionDraft["checkout"] => {
  if (draft.checkout) return draft.checkout;
  return coerceCheckoutDetails(getDraftPayload(draft).checkout);
};

const getDraftProductId = (draft: AssistantActionDraft) => {
  const payload = getDraftPayload(draft);
  return draft.productId ??
    (typeof payload.productId === "string" ? payload.productId : undefined);
};

const getDraftQuantity = (draft: AssistantActionDraft) => {
  const payload = getDraftPayload(draft);
  const value = draft.quantity ?? payload.quantity;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
};

const getDraftVoucherCode = (draft: AssistantActionDraft) => {
  const payload = getDraftPayload(draft);
  return draft.voucherCode ??
    (typeof payload.voucherCode === "string" ? payload.voucherCode : undefined);
};

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
    const checkout = getDraftCheckout(draft);
    socketRef.current.emit("assistant-confirm-action", {
      roomId,
      draftId: draft.draftId,
      displayText,
      productId: getDraftProductId(draft),
      quantity: getDraftQuantity(draft),
      voucherCode: getDraftVoucherCode(draft),
      checkout,
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
