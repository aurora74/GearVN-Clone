import {
  Box,
  Users,
  Layers,
  Receipt,
  Calendar,
  Newspaper,
  MessageSquare,
  LayoutDashboard,
} from "lucide-react";

export const SIDEBAR_GROUPED_ITEMS = [
  {
    title: "Tổng quan",
    items: [
      {
        title: "Thống kê",
        url: "/admin/dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    title: "Quản lý sản phẩm",
    items: [
      { title: "Sản phẩm", url: "/admin/products", icon: Box },
      { title: "Danh mục", url: "/admin/categories", icon: Layers },
    ],
  },
  {
    title: "Bán hàng",
    items: [
      { title: "Đơn hàng", url: "/admin/orders", icon: Receipt },
      { title: "Khách hàng", url: "/admin/customers", icon: Users },
    ],
  },
  {
    title: "Nội dung & hệ thống",
    items: [
      { title: "Bài viết", url: "/admin/blogs", icon: Newspaper },
      { title: "Sự kiện", url: "/admin/events", icon: Calendar },
    ],
  },
  {
    title: "Hỗ trợ khách hàng",
    items: [
      { title: "Chat khách hàng", url: "/admin/chat", icon: MessageSquare },
    ],
  },
];
