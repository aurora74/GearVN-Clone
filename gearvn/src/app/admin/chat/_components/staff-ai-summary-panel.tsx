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
  summary?: StaffAiSummary;
};

const formatList = (items: string[]) =>
  items.length > 0 ? items.join(", ") : "Chưa ghi nhận";

const formatValue = (value: string | null) => value?.trim() || "Chưa ghi nhận";

const formatConfidence = (value: StaffAiSummary["confidence"]) => {
  if (typeof value === "number") {
    const percent = value <= 1 ? value * 100 : value;
    return `${Math.round(percent)}%`;
  }

  return formatValue(value);
};

const formatHandoffTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

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

  const transcriptTargetId = `admin-chat-transcript-${summary.transcriptRoomId}`;
  const summaryLine = [
    summary.need,
    summary.budget ? `Ngân sách: ${summary.budget}` : null,
    summary.unresolvedQuestions.length > 0
      ? `${summary.unresolvedQuestions.length} câu hỏi chưa rõ`
      : null,
  ]
    .filter(Boolean)
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
            <SummaryField label="Nhu cầu khách hàng" value={summary.need} />
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
