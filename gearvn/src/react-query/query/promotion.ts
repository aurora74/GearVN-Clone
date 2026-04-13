import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "../query-keys";

import { PromotionSummary } from "@/types/promotion";

export const usePromotionSummary = () =>
  useQuery<PromotionSummary>({
    queryKey: queryKeys.promotion.summary,
    queryFn: async () => {
      const response = await fetch("/api/promotions/summary", {
        credentials: "include",
      });
      const { result } = await response.json();
      return result;
    },
  });
