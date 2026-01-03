import Link from "next/link";

import { LucideIcon } from "lucide-react";

import { cn } from "@/utils/cn";

import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

type SidebarItemProps = {
  url: string;
  title: string;
  icon: LucideIcon;
  isActive: boolean;
};

export const SidebarItem = ({
  url,
  title,
  isActive,
  icon: Icon,
}: SidebarItemProps) => (
  <SidebarMenuItem>
    <SidebarMenuButton
      asChild
      className={cn(
        "hover:font-medium hover:text-primary hover:bg-primary/10",
        isActive
          ? "font-medium text-primary bg-primary/10"
          : "text-muted-foreground"
      )}
    >
      <Link href={url} className="flex items-center gap-2">
        <Icon size={18} />
        <span>{title}</span>
      </Link>
    </SidebarMenuButton>
  </SidebarMenuItem>
);
