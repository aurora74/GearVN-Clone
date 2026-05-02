import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "../query-keys";

import { PaginatedResponse } from "@/types/global";
import { UseOrdersParams, Order } from "@/types/order";

const parseOrderResponse = async (response: Response) => {
  const data = await response.json();
  if (!response.ok) throw data;
  return data.result;
};

export const useOrder = (orderId: string) =>
  useQuery<Order>({
    queryKey: queryKeys.order.detail(orderId),
    enabled: !!orderId,
    queryFn: async () => {
      const response = await fetch(`/api/orders/${orderId}`, {
        credentials: "include",
      });

      return parseOrderResponse(response);
    },
  });

export const useOrderByCode = (orderCode: string) => {
  const normalizedOrderCode = orderCode.trim();

  return useQuery<Order>({
    queryKey: queryKeys.order.byCode(normalizedOrderCode),

    enabled: normalizedOrderCode.length > 0,

    queryFn: async () => {
      const response = await fetch(
        `/api/orders/code/${encodeURIComponent(normalizedOrderCode)}`,
        {
          credentials: "include",
        }
      );

      return parseOrderResponse(response);
    },
  });
};

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

      return parseOrderResponse(response);
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

      return parseOrderResponse(response);
    },
  });
