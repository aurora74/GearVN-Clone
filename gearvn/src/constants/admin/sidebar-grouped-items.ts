import {
  Box,
  Users,
  Layers,
  Receipt,
  Settings,
  Newspaper,
  MessageSquare,
  TicketPercent,
  LayoutDashboard,
} from "lucide-react";

import { USER_ROLE } from "@/config.global";

import type { UserRole } from "@/types/user";
import type { LucideIcon } from "lucide-react";

const ADMIN_ROLES = [USER_ROLE.ADMIN] as const;
const BUSINESS_ROLES = [
  USER_ROLE.MANAGER,
  USER_ROLE.PRODUCT_MARKETING_STAFF,
  USER_ROLE.SALES_OPERATIONS_STAFF,
  USER_ROLE.CSR,
] as const;
const MANAGER_ROLES = [USER_ROLE.MANAGER] as const;
const PRODUCT_MARKETING_ROLES = [
  USER_ROLE.MANAGER,
  USER_ROLE.PRODUCT_MARKETING_STAFF,
] as const;
const SALES_OPERATIONS_ROLES = [
  USER_ROLE.MANAGER,
  USER_ROLE.SALES_OPERATIONS_STAFF,
] as const;
const CSR_ROLES = [USER_ROLE.MANAGER, USER_ROLE.CSR] as const;
const ACCOUNT_GOVERNANCE_ROLES = [USER_ROLE.ADMIN, USER_ROLE.MANAGER] as const;

type AllowedRoles = readonly UserRole[];

export const SIDEBAR_GROUPED_ITEMS = [
  {
    title: "Tong quan",
    allowedRoles: BUSINESS_ROLES,
    items: [
      {
        title: "Thong ke",
        url: "/admin/dashboard",
        icon: LayoutDashboard,
        allowedRoles: MANAGER_ROLES,
      },
    ],
  },
  {
    title: "Quan ly san pham",
    allowedRoles: PRODUCT_MARKETING_ROLES,
    items: [
      {
        title: "San pham",
        url: "/admin/products",
        icon: Box,
        allowedRoles: PRODUCT_MARKETING_ROLES,
      },
      {
        title: "Danh muc",
        url: "/admin/categories",
        icon: Layers,
        allowedRoles: PRODUCT_MARKETING_ROLES,
      },
    ],
  },
  {
    title: "Ban hang",
    allowedRoles: SALES_OPERATIONS_ROLES,
    items: [
      {
        title: "Don hang",
        url: "/admin/orders",
        icon: Receipt,
        allowedRoles: SALES_OPERATIONS_ROLES,
      },
      {
        title: "Tồn kho",
        url: "/admin/products?workflow=stock",
        icon: Box,
        allowedRoles: SALES_OPERATIONS_ROLES,
      },
    ],
  },
  {
    title: "Noi dung & khuyen mai",
    allowedRoles: PRODUCT_MARKETING_ROLES,
    items: [
      {
        title: "Bai viet",
        url: "/admin/blogs",
        icon: Newspaper,
        allowedRoles: PRODUCT_MARKETING_ROLES,
      },
      {
        title: "Khuyen mai",
        url: "/admin/promotions",
        icon: TicketPercent,
        allowedRoles: PRODUCT_MARKETING_ROLES,
      },
    ],
  },
  {
    title: "Hỗ trợ khách hàng",
    allowedRoles: CSR_ROLES,
    items: [
      {
        title: "Chat khách hàng",
        url: "/admin/chat",
        icon: MessageSquare,
        allowedRoles: CSR_ROLES,
      },
    ],
  },
  {
    title: "Tai khoan",
    allowedRoles: ACCOUNT_GOVERNANCE_ROLES,
    items: [
      {
        title: "Khach hang",
        url: "/admin/customers",
        icon: Users,
        allowedRoles: ADMIN_ROLES,
      },
      {
        title: "Nhan su",
        url: "/admin/staff",
        icon: Users,
        allowedRoles: MANAGER_ROLES,
      },
    ],
  },
  {
    title: "Quan tri he thong",
    allowedRoles: ADMIN_ROLES,
    items: [
      {
        title: "Cau hinh he thong",
        url: "/admin/system",
        icon: Settings,
        allowedRoles: ADMIN_ROLES,
      },
    ],
  },
] satisfies Array<{
  title: string;
  allowedRoles: AllowedRoles;
  items: Array<{
    title: string;
    url: string;
    icon: LucideIcon;
    allowedRoles: AllowedRoles;
  }>;
}>;
