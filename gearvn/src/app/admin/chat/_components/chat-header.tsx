"use client";

import { CheckCircle2 } from "lucide-react";

import { SUPPORT_TICKET_STATUS } from "@/config.global";
import { User } from "@/types/chat";
import type { SupportTicket, SupportTicketStatus } from "@/types/engagement";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const STATUS_LABEL: Record<SupportTicketStatus, string> = {
  [SUPPORT_TICKET_STATUS.NEW]: "Mới",
  [SUPPORT_TICKET_STATUS.PROCESSING]: "Đang xử lý",
  [SUPPORT_TICKET_STATUS.RESOLVED]: "Đã giải quyết",
};

export const ChatHeader = ({
  user,
  ticket,
  onResolve,
  isResolving,
}: {
  user: User;
  ticket?: SupportTicket;
  onResolve?: () => void;
  isResolving?: boolean;
}) => {
  const isResolved = ticket?.status === SUPPORT_TICKET_STATUS.RESOLVED;

  return (
    <header className="p-3 sm:p-4 border-b bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="size-10">
            <AvatarImage
              alt={user?.fullName}
              src={user?.avatarUrl || "/avatar-default.jpg"}
            />
            <AvatarFallback className="text-white bg-primary">
              {user?.fullName
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2) || "?"}
            </AvatarFallback>
          </Avatar>

          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium text-gray-900">
              {user?.fullName ?? "Ẩn danh"}
            </span>

            <div className="flex items-center gap-1">
              {user?.online && (
                <span className="size-3 border-2 border-white bg-green-500 rounded-full" />
              )}
              <span className="text-sm text-muted-foreground">
                {user?.online ? "Đang hoạt động" : "Không hoạt động"}
              </span>
            </div>
          </div>
        </div>

        {ticket && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isResolved ? "outline" : "default"} className="rounded-sm">
              {STATUS_LABEL[ticket.status]}
            </Badge>
            {!isResolved && onResolve && (
              <Button size="sm" variant="outline" disabled={isResolving} onClick={onResolve}>
                <CheckCircle2 className="size-4" />
                Đánh dấu đã giải quyết
              </Button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
