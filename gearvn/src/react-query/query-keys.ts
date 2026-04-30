import { DashboardSummaryParams } from "@/types/dashboard";
import { UseBlogsParams } from "@/types/blog";
import { UseOrdersParams } from "@/types/order";
import { UseProductsParams, UseRelatedProductsParams } from "@/types/product";
import { SupportTicketListParams } from "@/types/engagement";
import { PublicVoucherParams, UseVouchersParams } from "@/types/voucher";

export const queryKeys = {
  user: {
    root: ["users"],
    me: ["users", "me"],
    list: ({
      page = 1,
      limit = 20,
      search = "",
      sortBy = "",
    }: {
      page?: number;
      limit?: number;
      search?: string;
      sortBy?: string;
    }) => ["users", "list", page, limit, search, sortBy],
    staff: ({
      page = 1,
      limit = 20,
      search = "",
      sortBy = "",
    }: {
      page?: number;
      limit?: number;
      search?: string;
      sortBy?: string;
    }) => ["users", "staff", page, limit, search, sortBy],
    detail: (id: string) => ["users", "detail", id],
  },

  systemConfig: {
    root: ["system-config"],
    list: ["system-config", "list"],
    detail: (key: string) => ["system-config", "detail", key],
  },

  product: {
    root: ["products"],
    list: ({
      page = 1,
      limit = 20,
      search = "",
      category = "",
      sortBy = "",
      attributes = {},
      event = "",
      visibility,
    }: UseProductsParams) => [
      "products",
      "list",
      page,
      limit,
      search,
      category,
      sortBy,
      attributes,
      event,
      visibility ?? "",
    ],
    detail: (id: string) => ["products", "detail", id],
    related: (productId: string, params?: UseRelatedProductsParams) => [
      "products",
      "related",
      productId,
      params,
    ],
  },
  products: {
    all: ["products"],
  },

  blog: {
    root: ["blogs"],
    list: ({
      page = 1,
      limit = 10,
      search = "",
      sortBy = "",
      includeUnpublished = false,
      visibility,
    }: UseBlogsParams) => [
      "blogs",
      "list",
      page,
      limit,
      search,
      sortBy,
      includeUnpublished,
      visibility ?? "",
    ],
    detail: (slug: string) => ["blogs", "detail", slug],
    related: (blogId: string) => ["blogs", "related", blogId],
    comments: (blogIdOrSlug: string) => ["blogs", "comments", blogIdOrSlug],
  },

  order: {
    me: (params: UseOrdersParams) => ["orders", "me", params],
    root: ["orders"],
    list: ({
      page = 1,
      limit = 10,
      search = "",
      sortBy = "",
      status = "",
      orderStatus,
      paymentStatus,
      paymentMethod,
      totalFrom,
      totalTo,
      dateFrom,
      dateTo,
    }: UseOrdersParams) => [
      "orders",
      "list",
      {
        page,
        limit,
        search,
        sortBy,
        status,
        orderStatus,
        paymentStatus,
        paymentMethod,
        totalFrom,
        totalTo,
        dateFrom,
        dateTo,
      },
    ],
    detail: (orderId: string) => ["orders", "detail", orderId],
    byCode: (orderCode: string) => ["orders", "byCode", orderCode],
  },

  category: {
    root: ["categories"],
    list: ({
      page = 1,
      limit = 20,
      search = "",
      sortBy = "",
      visibility = "",
    }: {
      page?: number;
      limit?: number;
      search?: string;
      sortBy?: string;
      visibility?: string;
    }) => ["categories", "list", page, limit, search, sortBy, visibility],
    detail: (id: string) => ["categories", "detail", id],
    slug: (slug: string) => ["categories", "slug", slug],
    byName: (name: string) => ["categories", "byName", name],
  },

  dashboard: {
    root: ["dashboard"],
    summary: (params: DashboardSummaryParams = {}) => [
      "dashboard",
      "summary",
      params,
    ],
  },

  event: {
    root: ["events"],
    list: ({
      page = 1,
      limit = 20,
      search = "",
      sortBy = "",
      tag = "",
      visibility = "",
    }: {
      page?: number;
      limit?: number;
      search?: string;
      sortBy?: string;
      tag?: string;
      visibility?: string;
    }) => ["events", "list", page, limit, search, sortBy, tag, visibility],
    detail: (id: string) => ["events", "detail", id],
  },

  voucher: {
    root: ["vouchers"],
    list: ({ page = 1, limit = 20, search = "" }: UseVouchersParams = {}) => [
      "vouchers",
      "list",
      page,
      limit,
      search,
    ],
    public: (params: PublicVoucherParams = {}) => ["vouchers", "public", params],
    detail: (id: string) => ["vouchers", "detail", id],
  },

  promotion: {
    root: ["promotions"],
    summary: ["promotions", "summary"],
  },
  chat: {
    root: ["chats"],

    list: ({
      roomId = "",
      page = 1,
      limit = 20,
      search = "",
      sortBy = "",
    }: {
      roomId?: string;
      page?: number;
      limit?: number;
      search?: string;
      sortBy?: string;
    }) => ["chats", "list", roomId, page, limit, search, sortBy],

    latest: ({
      roomId = "",
      page = 1,
      limit = 20,
      search = "",
      sortBy = "",
    }: {
      roomId?: string;
      page?: number;
      limit?: number;
      search?: string;
      sortBy?: string;
    } = {}) => ["chats", "latest", roomId, page, limit, search, sortBy],

    detail: (chatId: string) => ["chats", "detail", chatId],

    byRoom: ({
      roomId = "",
      page = 1,
      limit = 20,
      search = "",
      sortBy = "",
    }: {
      roomId?: string;
      page?: number;
      limit?: number;
      search?: string;
      sortBy?: string;
    } = {}) => ["chats", "byRoom", roomId, page, limit, search, sortBy],
  },

  productQuestion: {
    root: ["product-questions"],
    byProduct: (productId: string) => ["product-questions", "product", productId],
  },

  supportTicket: {
    root: ["support-tickets"],
    list: ({ status = undefined, page = 1, limit = 20 }: SupportTicketListParams = {}) => [
      "support-tickets",
      "list",
      status ?? "",
      page,
      limit,
    ],
    detail: (ticketId: string) => ["support-tickets", "detail", ticketId],
  },
};
