"use client";

import { Bell, Loader, Search } from "lucide-react";

import { USER_ROLE } from "@/config.global";
import { useMe } from "@/react-query/query/user";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";

import { UserSettings } from "@/components/global/home/header/user-settings";

import type { UserRole } from "@/types/user";

const ROLE_BADGE_LABEL: Record<UserRole, string> = {
  [USER_ROLE.ADMIN]: "Admin",
  [USER_ROLE.MANAGER]: "Manager",
  [USER_ROLE.PRODUCT_MARKETING_STAFF]: "Product & Marketing",
  [USER_ROLE.SALES_OPERATIONS_STAFF]: "Sales & Operations",
  [USER_ROLE.CSR]: "CSR",
  [USER_ROLE.CUSTOMER]: "Customer",
};

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
          user && (
            <>
              <Badge
                variant="secondary"
                className="hidden h-6 rounded-md px-2 text-xs font-medium sm:inline-flex"
              >
                {ROLE_BADGE_LABEL[user.role]}
              </Badge>
              <UserSettings user={user} />
            </>
          )
        )}
      </div>
    </div>
  );
};
