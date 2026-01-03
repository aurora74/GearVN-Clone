import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "../query-keys";

import { PaginatedResponse } from "@/types/global";
import { UseOrdersParams, Order } from "@/types/order";

export const useOrder = (orderId: string) =>
  useQuery<Order>({
    queryKey: queryKeys.order.detail(orderId),
    enabled: !!orderId,
    queryFn: async () => {
      const response = await fetch(`/api/orders/${orderId}`, {
        credentials: "include",
      });

      const { result } = await response.json();
      return result;
    },
  });

export const useOrderByCode = (orderCode: string) =>
  useQuery<Order>({
    queryKey: queryKeys.order.byCode(orderCode),

    enabled: !!orderCode,

    queryFn: async () => {
      const response = await fetch(`/api/orders/code/${orderCode}`, {
        credentials: "include",
      });

      const { result } = await response.json();
      return result;
    },
  });

export const useMyOrders = (params: UseOrdersParams = { page: 1, limit: 10 }) =>
  useQuery<PaginatedResponse<Order>>({
    queryKey: queryKeys.order.me(params),

    queryFn: async () => {
      const queryParams = Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([key, value]) => [key, String(value)]);

      const query = new URLSearchParams(queryParams);

      const response = await fetch(`/api/orders/me?${query}`, {
        credentials: "include",
      });

      const { result } = await response.json();
      return result;
    },
  });

export const useOrders = (params: UseOrdersParams = {}) =>
  useQuery<PaginatedResponse<Order>>({
    queryKey: queryKeys.order.list(params),
    queryFn: async () => {
      const queryParams = Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([key, value]) => [key, String(value)]);

      const query = new URLSearchParams(queryParams);

      const response = await fetch(`/api/orders?${query}`, {
        credentials: "include",
      });

      const { result } = await response.json();
      return result;
    },
  });
