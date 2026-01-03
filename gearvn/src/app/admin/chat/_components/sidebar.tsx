"use client";

import { useState } from "react";

import { Trash2 } from "lucide-react";

import { cn } from "@/utils/cn";
import { User } from "@/types/chat";

import { SearchInput } from "./search-input";
import { MessageSkeleton } from "./message-skeleton";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { ModalDeleteMessage } from "@/components/modals/admin/chat/delete-message";
import { ModalDeleteMessages } from "@/components/modals/admin/chat/delete-messages";

type SidebarProps = {
  users: User[];
  isPending: boolean;
  selectedUser: string | null;
  onSelectUser: (id: string) => void;
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  setSelectedUser: (selectedUser: string | null) => void;
};

export const Sidebar = ({
  users,
  setUsers,
  isPending,
  selectedUser,
  onSelectUser,
  setSelectedUser,
}: SidebarProps) => {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const toggleSelectUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const isAllSelected = () =>
    users.length > 0 && selectedUsers.length === users.length;

  const deleteSingleUser = (userId: string) => {
    setSelectedUsers([]);
    setSelectedUser(null);
    setUsers((prevUsers) => prevUsers.filter((user) => user._id !== userId));
  };

  const deleteMultipleUsers = (userIds: string[]) => {
    setSelectedUsers([]);
    setSelectedUser(null);
    setUsers((prevUsers) =>
      prevUsers.filter((user) => !userIds.includes(user._id))
    );
  };

  const renderUnreadBadge = (unreadCount?: number) => {
    if (!unreadCount || unreadCount <= 0) return null;

    const displayCount = unreadCount > 9 ? "9+" : unreadCount;
    const badgeClass = cn(
      "ml-1 bg-red-500 text-white text-[12px] font-semibold leading-none inline-flex items-center justify-center rounded-full",
      unreadCount > 9 ? "h-5 min-w-[20px] px-2" : "h-5 w-5"
    );

    return <span className={badgeClass}>{displayCount}</span>;
  };

  return (
    <div className="h-full flex flex-col sm:border-r px-2 sm:pr-4 gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Tin nhắn</h2>

        {users.length > 0 && (
          <label className="flex items-center mt-2 cursor-pointer select-none">
            <Checkbox
              checked={isAllSelected()}
              onCheckedChange={(checked) =>
                checked
                  ? setSelectedUsers(users.map((u) => u._id))
                  : setSelectedUsers([])
              }
            />
            <span className="ml-2 text-sm text-gray-700">Chọn tất cả</span>
          </label>
        )}
      </div>

      <SearchInput />

      {selectedUsers.length > 0 &&
        (selectedUsers.length > 1 ? (
          <ModalDeleteMessages
            userIds={selectedUsers}
            onDeleted={() => deleteMultipleUsers(selectedUsers)}
          >
            <Button className="w-full flex items-center justify-center gap-2 text-sm text-white py-1 mt-2 bg-primary">
              <Trash2 className="size-4" />
              Xóa tất cả
            </Button>
          </ModalDeleteMessages>
        ) : (
          <ModalDeleteMessage
            userId={selectedUsers[0]}
            onDeleted={() => deleteSingleUser(selectedUsers[0])}
          >
            <Button className="w-full flex items-center justify-center gap-2 text-sm text-white py-1 mt-2 bg-primary">
              <Trash2 className="size-4" />
              Xóa tin nhắn
            </Button>
          </ModalDeleteMessage>
        ))}

      <div className="flex-1 overflow-y-auto custom-scroll">
        {isPending ? (
          <MessageSkeleton />
        ) : users.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-gray-400 italic">
            Chưa có cuộc trò chuyện nào
          </div>
        ) : (
          users.map((user) => (
            <div
              key={user._id}
              onClick={() => onSelectUser(user._id)}
              className={cn(
                "flex items-center py-3 space-x-3 hover:bg-white transition-colors duration-150 cursor-pointer select-none",
                selectedUser === user._id &&
                  "border-l-4 border-l-primary bg-white",
                selectedUser && "sm:pl-3"
              )}
            >
              <Checkbox
                checked={selectedUsers.includes(user._id)}
                onCheckedChange={() => toggleSelectUser(user._id)}
              />

              <div className="relative">
                <Avatar className="size-12">
                  <AvatarImage src={user.avatarUrl} alt={user.fullName} />
                  <AvatarFallback className="text-white bg-primary">
                    {user.fullName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={cn(
                    "absolute bottom-0 right-0 block size-3 ring-2 ring-white rounded-full",
                    user.online ? "bg-green-500" : "bg-gray-400"
                  )}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium truncate">
                    {user.fullName}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{user.time}</span>
                    {renderUnreadBadge(user.unreadCount)}
                  </div>
                </div>
                <p className="text-sm text-gray-600 italic mt-1 truncate">
                  {user.typing ? "Đang soạn tin..." : user.newMessage}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
