import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "../query-keys";

import { PaginatedResponse } from "@/types/global";
import { EventType, UseEventsParams } from "@/types/event";

export const useEvents = (params: UseEventsParams = { page: 1, limit: 10 }) =>
  useQuery<PaginatedResponse<EventType>>({
    queryKey: queryKeys.event.list(params),

    queryFn: async () => {
      const queryParams = Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([key, value]) => [key, String(value)]);

      const query = new URLSearchParams(queryParams);

      const response = await fetch(`/api/events?${query}`, {
        credentials: "include",
      });

      const { result } = await response.json();
      return result;
    },
  });
