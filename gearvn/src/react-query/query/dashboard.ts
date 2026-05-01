import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "../query-keys";
import { DashboardSummary, DashboardSummaryParams } from "@/types/dashboard";

const parseDashboardResponse = async (response: Response) => {
  const data = await response.json();
  if (!response.ok) throw data;
  return data.result;
};

export const useDashboardSummary = (params: DashboardSummaryParams = { preset: "30d" }) =>
  useQuery<DashboardSummary>({
    queryKey: queryKeys.dashboard.summary(params),
    queryFn: async () => {
      const queryParams = Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== "")
        .map(([key, value]) => [key, String(value)]);

      const query = new URLSearchParams(queryParams);
      const queryString = query.toString();
      const response = await fetch(
        `/api/dashboard/summary${queryString ? `?${queryString}` : ""}`,
        {
          credentials: "include",
        }
      );

      return parseDashboardResponse(response);
    },
  });
