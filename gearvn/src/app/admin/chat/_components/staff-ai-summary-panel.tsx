"use client";

import { useEffect, useState } from "react";

import {
  ChevronDown,
  ChevronUp,
  Clock3,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";

import type { StaffAiSummary } from "@/types/engagement";
import { cn } from "@/utils/cn";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type StaffAiSummaryPanelProps = {
  summary?: Partial<Record<keyof StaffAiSummary, unknown>>;
};

const EMPTY_VALUE_LABEL = "Chưa ghi nhận";

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.prototype.toString.call(value) === "[object Object]";

const formatScalarValue = (value: unknown): string | null => {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  if (typeof value === "boolean") return value ? "Có" : "Không";

  return null;
};

const formatList = (items: unknown) => {
  if (!Array.isArray(items)) return formatValue(items);

  const values = items
    .map((item) => formatScalarValue(item))
    .filter((item): item is string => Boolean(item));

  return values.length > 0 ? values.join(", ") : EMPTY_VALUE_LABEL;
};

const formatValue = (value: unknown): string => {
  const scalarValue = formatScalarValue(value);
  if (scalarValue) return scalarValue;

  if (Array.isArray(value)) return formatList(value);

  if (isPlainObject(value)) {
    const values = Object.entries(value)
      .map(([key, item]) => {
        const itemValue = Array.isArray(item)
          ? formatList(item)
          : formatScalarValue(item);

        if (!itemValue || itemValue === EMPTY_VALUE_LABEL) return null;
        return `${key}: ${itemValue}`;
      })
      .filter((item): item is string => Boolean(item));

    return values.length > 0 ? values.join("; ") : EMPTY_VALUE_LABEL;
  }

  return EMPTY_VALUE_LABEL;
};

const formatConfidence = (value: unknown) => {
  if (typeof value === "number") {
    const percent = value <= 1 ? value * 100 : value;
    return `${Math.round(percent)}%`;
  }

  return formatValue(value);
};

const formatHandoffTime = (value: unknown) => {
  const handoffValue = formatScalarValue(value);
  if (!handoffValue) return EMPTY_VALUE_LABEL;

  const date = new Date(handoffValue);
  if (Number.isNaN(date.getTime())) return handoffValue;

  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export const StaffAiSummaryPanel = ({ summary }: StaffAiSummaryPanelProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const summaryKey = summary
    ? `${summary.transcriptRoomId}-${summary.latestHandoffAt}`
    : "";

  useEffect(() => {
    if (summaryKey) setIsExpanded(true);
  }, [summaryKey]);

  if (!summary || summary.staffOnly !== true) return null;

  const transcriptRoomId = formatScalarValue(summary.transcriptRoomId) ?? "unknown";
  const transcriptTargetId = `admin-chat-transcript-${transcriptRoomId}`;
  const unresolvedQuestionCount = Array.isArray(summary.unresolvedQuestions)
    ? summary.unresolvedQuestions.filter((item) => formatScalarValue(item)).length
    : 0;
  const summaryLine = [
    formatValue(summary.need),
    formatScalarValue(summary.budget)
      ? `Ngân sách: ${formatScalarValue(summary.budget)}`
      : null,
    unresolvedQuestionCount > 0
      ? `${unresolvedQuestionCount} câu hỏi chưa rõ`
      : null,
  ]
    .filter((item) => Boolean(item) && item !== EMPTY_VALUE_LABEL)
    .join(" • ");

  const handleOpenTranscript = () => {
    const target = document.getElementById(transcriptTargetId);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
    target?.focus({ preventScroll: true });
  };

  return (
    <section
      className="border-b bg-white px-3 py-3 text-[14px] leading-[1.5] sm:px-4"
      aria-label="Tóm tắt AI cho nhân viên"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[16px] font-semibold leading-[1.25]">
              Tóm tắt AI
            </h2>
            <Badge variant="secondary" className="rounded-sm">
              <ShieldCheck className="size-3" />
              Chỉ nhân viên thấy
            </Badge>
          </div>
          <p className="line-clamp-2 text-[14px] text-muted-foreground">
            {summaryLine || "AI đã chuyển cuộc trò chuyện cho nhân viên."}
          </p>
        </div>

        <Button
          type="button"
          variant="ghost"
          className="min-h-11 rounded-sm px-3 focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Thu gọn tóm tắt AI" : "Mở rộng tóm tắt AI"}
          onClick={() => setIsExpanded((current) => !current)}
        >
          {isExpanded ? (
            <ChevronUp className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
          {isExpanded ? "Thu gọn" : "Xem thêm"}
        </Button>
      </div>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200",
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <SummaryField
              label="Nhu cầu khách hàng"
              value={formatValue(summary.need)}
            />
            <SummaryField label="Ngân sách" value={formatValue(summary.budget)} />
            <SummaryField
              label="Ràng buộc / cấu hình"
              value={formatList(summary.constraints)}
            />
            <SummaryField
              label="Sản phẩm đã trao đổi"
              value={formatList(summary.productsDiscussed)}
            />
            <SummaryField
              label="Giỏ hàng / thanh toán"
              value={formatValue(summary.cartCheckoutContext)}
            />
            <SummaryField
              label="Đơn hàng"
              value={formatValue(summary.orderContext)}
            />
            <SummaryField
              label="Câu hỏi chưa rõ"
              value={formatList(summary.unresolvedQuestions)}
            />
            <SummaryField
              label="Độ tin cậy / chưa chắc chắn"
              value={`${formatConfidence(summary.confidence)} • ${formatValue(
                summary.uncertainty
              )}`}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
            <div className="flex min-w-0 items-center gap-2 text-[12px] leading-[1.35] text-muted-foreground">
              <Clock3 className="size-4 shrink-0" />
              <span>Chuyển lúc {formatHandoffTime(summary.latestHandoffAt)}</span>
            </div>

            <Button
              type="button"
              variant="outline"
              className="min-h-11 rounded-sm focus-visible:ring-2 focus-visible:ring-ring"
              onClick={handleOpenTranscript}
            >
              <MessageSquareText className="size-4" />
              Mở toàn bộ hội thoại
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

const SummaryField = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0 space-y-1">
    <p className="text-[12px] leading-[1.35] text-muted-foreground">{label}</p>
    <p className="whitespace-pre-wrap break-words text-[14px] leading-[1.5] text-foreground">
      {value || "Chưa ghi nhận"}
    </p>
  </div>
);
