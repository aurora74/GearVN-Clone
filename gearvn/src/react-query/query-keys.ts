import { UseOrdersParams } from "@/types/order";
import { UseProductsParams, UseRelatedProductsParams } from "@/types/product";

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
    detail: (id: string) => ["users", "detail", id],
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
    ],
    detail: (id: string) => ["products", "detail", id],
    related: (productId: string, params?: UseRelatedProductsParams) => [
      "products",
      "related",
      productId,
      params,
    ],
  },

  blog: {
    root: ["blogs"],
    list: ({
      page = 1,
      limit = 10,
      search = "",
      sortBy = "",
    }: {
      page?: number;
      limit?: number;
      search?: string;
      sortBy?: string;
    }) => ["blogs", "list", page, limit, search, sortBy],
    detail: (slug: string) => ["blogs", "detail", slug],
    related: (blogId: string) => ["blogs", "related", blogId],
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
    }: {
      page?: number;
      limit?: number;
      search?: string;
      sortBy?: string;
    }) => ["categories", "list", page, limit, search, sortBy],
    detail: (id: string) => ["categories", "detail", id],
    slug: (slug: string) => ["categories", "slug", slug],
    byName: (name: string) => ["categories", "byName", name],
  },

  dashboard: {
    root: ["dashboard"],
    summary: ["dashboard", "summary"],
  },

  event: {
    root: ["events"],
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
    }) => ["events", "list", page, limit, search, sortBy],
    detail: (id: string) => ["events", "detail", id],
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
};
