"use client";

import { Bell, Loader, Search } from "lucide-react";

import { useMe } from "@/react-query/query/user";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";

import { UserSettings } from "@/components/global/home/header/user-settings";

export const Navbar = () => {
  const { data: user, isPending } = useMe();

  return (
    <div className="h-fit flex items-center justify-between">
      <div className="flex items-center gap-2">
        <SidebarTrigger />

        <div className="relative">
          <Input
            placeholder="Tìm kiếm"
            className="w-full sm:w-[400px] pl-10 bg-white"
          />
          <Search className="absolute top-1/2 left-3 -translate-y-1/2 size-4.5 text-gray-400" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon">
          <Bell />
        </Button>

        {isPending ? (
          <Loader className="flex-shrink-0 size-5 text-primary animate-spin" />
        ) : (
          user && <UserSettings user={user} />
        )}
      </div>
    </div>
  );
};
