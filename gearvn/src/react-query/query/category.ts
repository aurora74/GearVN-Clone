import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "../query-keys";

import {
  CategoryType,
  CategoryFields,
  UseCategoriesParams,
} from "@/types/category";
import { PaginatedResponse } from "@/types/global";

export const useCategories = (
  params: UseCategoriesParams = { page: 1, limit: 20 }
) =>
  useQuery<PaginatedResponse<CategoryType>>({
    queryKey: queryKeys.category.list(params),

    queryFn: async () => {
      const queryParams = Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([key, value]) => [key, String(value)]);

      const query = new URLSearchParams(queryParams);

      const response = await fetch(`/api/categories?${query}`, {
        credentials: "include",
      });

      const { result } = await response.json();
      return result;
    },
  });

export const useCategoryByName = (name: string) =>
  useQuery<CategoryFields[]>({
    queryKey: queryKeys.category.byName(name),

    queryFn: async () => {
      const response = await fetch(`/api/categories/fields/${name}`, {
        credentials: "include",
      });

      const { result } = await response.json();
      return result;
    },
  });
