"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { CameraIcon } from "lucide-react";

import { cn } from "@/utils/cn";
import { SETTING_ITEMS } from "@/constants/setting-items";

import { useMe } from "@/react-query/query/user";
import { useEditUser } from "@/react-query/mutation/user";

import { SidebarSkeleton } from "./sidebar-skeleton";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Sidebar = () => {
  const { data: user, isPending: isPendingUser } = useMe();

  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(
    user?.avatarUrl || null
  );

  useEffect(() => {
    return () => {
      if (preview && !user?.avatarUrl) URL.revokeObjectURL(preview);
    };
  }, [preview, user?.avatarUrl]);

  const { mutate: editUser, isPending: isEditingUser } = useEditUser();

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user?._id) return;

    const file = e.target.files?.[0];
    if (!file) return;

    const newPreview = URL.createObjectURL(file);
    if (preview && !user?.avatarUrl) URL.revokeObjectURL(preview);
    setPreview(newPreview);

    editUser({ id: user._id, avatar: file });
  };

  if (isPendingUser || !user) return <SidebarSkeleton />;

  return (
    <aside className="w-full lg:w-[22%] lg:sticky top-[5.5rem] self-start max-h-screen overflow-y-auto p-4 space-y-6 border bg-white shadow-sm rounded-lg">
      <div className="flex items-center gap-4">
        <div
          tabIndex={0}
          role="button"
          aria-label="Thay đổi avatar"
          onClick={() => !isEditingUser && inputRef.current?.click()}
          onKeyDown={(e) => {
            if (!isEditingUser && (e.key === "Enter" || e.key === " ")) {
              inputRef.current?.click();
            }
          }}
          className={cn(
            "relative group cursor-pointer",
            isEditingUser && "opacity-50 pointer-events-none"
          )}
        >
          <Avatar className="size-12">
            <AvatarImage
              src={preview || "/avatar-default.jpg"}
              alt={`${user.fullName} avatar`}
            />
            <AvatarFallback>{user.fullName?.charAt(0) || "?"}</AvatarFallback>
          </Avatar>
          <div className="absolute bottom-0 right-0 p-1 bg-white rounded-full shadow group-hover:opacity-100 opacity-0 transition-opacity">
            <CameraIcon className="size-4 text-gray-600" />
          </div>
          <input
            type="file"
            ref={inputRef}
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
            disabled={isEditingUser}
          />
        </div>

        <div className="w-40 overflow-hidden">
          <p className="font-semibold truncate">{user.fullName}</p>
          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
        </div>
      </div>

      <nav aria-label="Cài đặt hồ sơ">
        <ul className="space-y-2 text-sm text-muted-foreground">
          {SETTING_ITEMS.map(({ href, label, icon: IconComp }) => {
            const active = pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 text-[15px] font-medium hover:text-primary p-2 hover:bg-primary/10 rounded-md",
                    active && "text-primary bg-primary/10"
                  )}
                >
                  <IconComp className="size-4" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
};
