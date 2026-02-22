import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "../query-keys";
import { PaginatedResponse } from "@/types/global";
import {
  ProductQuestion,
  SupportTicket,
  SupportTicketListParams,
} from "@/types/engagement";

const parseResult = async <T>(response: Response): Promise<T> => {
  const data = await response.json();
  if (!response.ok) throw data;
  return data.result;
};

export const useProductQuestionsByProduct = (productId: string) =>
  useQuery<ProductQuestion[]>({
    queryKey: queryKeys.productQuestion.byProduct(productId),
    enabled: !!productId,
    queryFn: async () => {
      const response = await fetch(`/api/product-questions/product/${productId}`, {
        credentials: "include",
      });

      return parseResult<ProductQuestion[]>(response);
    },
  });

export const useSupportTickets = (
  params: SupportTicketListParams = { page: 1, limit: 20 }
) =>
  useQuery<PaginatedResponse<SupportTicket>>({
    queryKey: queryKeys.supportTicket.list(params),
    queryFn: async () => {
      const query = new URLSearchParams(
        Object.fromEntries(
          Object.entries(params)
            .filter(([, value]) => value !== undefined)
            .map(([key, value]) => [key, String(value)])
        )
      );

      const response = await fetch(`/api/support-tickets?${query}`, {
        credentials: "include",
      });

      return parseResult<PaginatedResponse<SupportTicket>>(response);
    },
  });

export const useSupportTicket = (ticketId?: string) =>
  useQuery<SupportTicket>({
    queryKey: queryKeys.supportTicket.detail(ticketId ?? ""),
    enabled: !!ticketId,
    queryFn: async () => {
      const response = await fetch(`/api/support-tickets/${ticketId}`, {
        credentials: "include",
      });

      return parseResult<SupportTicket>(response);
    },
  });
