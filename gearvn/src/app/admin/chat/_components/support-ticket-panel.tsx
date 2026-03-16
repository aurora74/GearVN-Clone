"use client";

import Link from "next/link";
import { CheckCircle2, Clock, ExternalLink, MessageSquareText } from "lucide-react";

import { SUPPORT_TICKET_SOURCE, SUPPORT_TICKET_STATUS } from "@/config.global";
import {
  useSupportTickets,
} from "@/react-query/query/engagement";
import { useUpdateSupportTicketStatus } from "@/react-query/mutation/engagement";
import { SupportTicket, SupportTicketStatus } from "@/types/engagement";
import { cn } from "@/utils/cn";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS: Array<{ value: SupportTicketStatus; label: string }> = [
  { value: SUPPORT_TICKET_STATUS.NEW, label: "Mới" },
  { value: SUPPORT_TICKET_STATUS.PROCESSING, label: "Đang xử lý" },
  { value: SUPPORT_TICKET_STATUS.RESOLVED, label: "Đã giải quyết" },
];

const STATUS_LABEL: Record<SupportTicketStatus, string> = {
  [SUPPORT_TICKET_STATUS.NEW]: "Mới",
  [SUPPORT_TICKET_STATUS.PROCESSING]: "Đang xử lý",
  [SUPPORT_TICKET_STATUS.RESOLVED]: "Đã giải quyết",
};

const getCustomerLabel = (ticket: SupportTicket) => {
  if (typeof ticket.customerId === "object") {
    return ticket.customerId.fullName || ticket.customerId.email || "Khách hàng";
  }

  return ticket.customerId || "Khách hàng";
};

const getSourceLabel = (ticket: SupportTicket) =>
  ticket.sourceType === SUPPORT_TICKET_SOURCE.PRODUCT_QNA ? "Q&A" : "Chat";

const getQuestionHref = (ticket: SupportTicket) => {
  if (
    ticket.sourceType !== SUPPORT_TICKET_SOURCE.PRODUCT_QNA ||
    !ticket.sourceId ||
    !ticket.metadata?.productSlug
  ) {
    return null;
  }

  return `/products/${ticket.metadata.productSlug}#question-${ticket.sourceId}`;
};

const TicketRow = ({ ticket }: { ticket: SupportTicket }) => {
  const { mutate: updateStatus, isPending } = useUpdateSupportTicketStatus();
  const isResolved = ticket.status === SUPPORT_TICKET_STATUS.RESOLVED;
  const questionHref = getQuestionHref(ticket);
  return (
    <div className="grid gap-3 border-t py-3 first:border-t-0 md:grid-cols-[140px_90px_minmax(0,1fr)_140px_160px_44px] md:items-center">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{ticket.ticketCode}</p>
        <p className="text-xs text-muted-foreground">
          {new Date(ticket.latestActivityAt).toLocaleString("vi-VN")}
        </p>
      </div>

      <Badge
        variant={ticket.sourceType === SUPPORT_TICKET_SOURCE.PRODUCT_QNA ? "default" : "secondary"}
        className="rounded-sm"
      >
        {getSourceLabel(ticket)}
      </Badge>

      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{getCustomerLabel(ticket)}</p>
        <p className="truncate text-xs text-muted-foreground">
          {ticket.contextLabel}
        </p>
      </div>

      <Badge
        variant={ticket.status === SUPPORT_TICKET_STATUS.NEW ? "default" : "outline"}
        className={cn(
          "rounded-sm",
          ticket.status === SUPPORT_TICKET_STATUS.RESOLVED &&
            "border-muted text-muted-foreground"
        )}
      >
        {STATUS_LABEL[ticket.status]}
      </Badge>

      <div className="flex justify-start md:justify-end">
        {!isResolved && (
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() =>
              updateStatus({
                ticketId: ticket._id,
                status: SUPPORT_TICKET_STATUS.RESOLVED,
              })
            }
          >
            <CheckCircle2 className="size-4" />
            Đánh dấu đã giải quyết
          </Button>
        )}
      </div>

      <div className="flex justify-start md:justify-end">
        {questionHref && (
          <Button size="icon" variant="ghost" asChild aria-label="Mở câu hỏi sản phẩm">
            <Link href={questionHref}>
              <ExternalLink className="size-4" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
};

export const SupportTicketPanel = () => {
  return (
    <section className="rounded-sm border bg-white p-3 shadow-sm sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Hàng chờ hỗ trợ</h2>
          <p className="text-sm text-muted-foreground">
            Yêu cầu mới từ Q&A và chat sẽ xuất hiện tại đây.
          </p>
        </div>
        <MessageSquareText className="size-5 text-primary" />
      </div>

      <Tabs defaultValue={SUPPORT_TICKET_STATUS.NEW}>
        <TabsList className="w-full justify-start overflow-x-auto rounded-sm">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="min-w-fit">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-3">
            <SupportTicketTab status={tab.value} />
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
};

const SupportTicketTab = ({ status }: { status: SupportTicketStatus }) => {
  const { data, isPending } = useSupportTickets({ status, page: 1, limit: 5 });
  const tickets = data?.data ?? [];

  if (isPending) {
    return (
      <div className="space-y-2">
        {[1, 2].map((item) => (
          <div key={item} className="h-14 animate-pulse rounded-sm bg-muted" />
        ))}
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-sm border border-dashed p-3 text-sm text-muted-foreground">
        <Clock className="size-4" />
        Chưa có yêu cầu hỗ trợ
      </div>
    );
  }

  return (
    <div className="divide-y-0">
      {tickets.map((ticket) => (
        <TicketRow key={ticket._id} ticket={ticket} />
      ))}
    </div>
  );
};
