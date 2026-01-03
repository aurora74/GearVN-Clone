"use client";

import { User } from "@/types/chat";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const ChatHeader = ({ user }: { user: User }) => (
  <header className="p-3 sm:p-4 border-b bg-white">
    <div className="flex items-center gap-3">
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

      <div className="flex flex-col">
        <span className="font-medium text-gray-900">
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
  </header>
);
