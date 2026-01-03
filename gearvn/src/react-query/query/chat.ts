import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "../query-keys";

import { PaginatedResponse } from "@/types/global";
import { Message, UseMessageParams } from "@/types/chat";

export const useMessagesByRoom = (
  roomId: string,
  params: UseMessageParams = { page: 1, limit: 20 }
) => {
  return useQuery<PaginatedResponse<Message>>({
    queryKey: queryKeys.chat.byRoom({ roomId, ...params }),

    queryFn: async () => {
      const queryParams = Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([key, value]) => [key, String(value)]);

      const query = new URLSearchParams(queryParams);

      const response = await fetch(`/api/chat/room/${roomId}?${query}`, {
        credentials: "include",
      });

      const { result } = await response.json();
      return result;
    },

    enabled: !!roomId,
  });
};

export const useLatestMessages = (params: UseMessageParams) =>
  useQuery<PaginatedResponse<Message>>({
    queryKey: queryKeys.chat.latest(params),

    queryFn: async () => {
      const queryParams = Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([key, value]) => [key, String(value)]);

      const query = new URLSearchParams(queryParams);

      const response = await fetch(`/api/chat/latest?${query}`, {
        credentials: "include",
      });

      const { result } = await response.json();
      return result;
    },
  });
