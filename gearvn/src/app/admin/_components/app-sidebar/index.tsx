"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

import { SIDEBAR_GROUPED_ITEMS } from "@/constants/admin/sidebar-grouped-items";
import { useMe } from "@/react-query/query/user";

import {
  Sidebar,
  SidebarMenu,
  SidebarGroup,
  SidebarHeader,
  SidebarContent,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar";

import { SidebarItem } from "./sidebar-item";

import type { UserRole } from "@/types/user";

const isAllowedForRole = (allowedRoles: readonly UserRole[], role: UserRole) =>
  allowedRoles.includes(role);

export const AppSidebar = (props: React.ComponentProps<typeof Sidebar>) => {
  const pathname = usePathname();
  const { data: user } = useMe();
  const currentRole = user?.role;

  const menu = currentRole
    ? SIDEBAR_GROUPED_ITEMS.map((group) => ({
        ...group,
        items: group.items
          .filter((item) => isAllowedForRole(item.allowedRoles, currentRole))
          .map((item) => ({
            ...item,
            isActive: pathname === item.url || pathname.startsWith(item.url + "/"),
          })),
      }))
        .filter((group) => {
          if (group.items.length === 0) return false;

          return isAllowedForRole(group.allowedRoles, currentRole);
        })
    : [];

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <Link href="/admin/dashboard" className="py-4">
          <div className="w-[180px] h-[60px] relative mx-auto">
            <Image
              fill
              priority
              alt="Logo"
              src="/logo-red.png"
              className="object-contain"
            />
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {menu.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel className="uppercase">
              {group.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarItem key={item.title} {...item} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
};
