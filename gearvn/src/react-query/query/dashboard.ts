import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "../query-keys";
import { DashboardSummary } from "@/types/dashboard";

export const useDashboardSummary = () =>
  useQuery<DashboardSummary>({
    queryKey: queryKeys.dashboard.summary,

    queryFn: async () => {
      const response = await fetch(`/api/dashboard/summary`, {
        credentials: "include",
      });

      const { result } = await response.json();
      return result;
    },
  });
