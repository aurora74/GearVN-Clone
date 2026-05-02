import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "../query-keys";

import { PaginatedResponse } from "@/types/global";
import { EventType, UseEventsParams } from "@/types/event";

const parseResult = async <T>(response: Response): Promise<T> => {
  const data = await response.json();
  if (!response.ok) throw data;
  return data.result;
};

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

      return parseResult<PaginatedResponse<EventType>>(response);
    },
  });
