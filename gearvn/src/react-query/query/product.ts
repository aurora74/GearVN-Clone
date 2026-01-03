import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "../query-keys";

import { PaginatedResponse } from "@/types/global";
import { ProductType, UseProductsParams } from "@/types/product";

export const useProducts = (params: UseProductsParams) =>
  useQuery<PaginatedResponse<ProductType>>({
    queryKey: queryKeys.product.list(params),

    queryFn: async () => {
      const queryParams = Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([key, value]) => [key, String(value)]);

      const query = new URLSearchParams(queryParams);

      const response = await fetch(`/api/products?${query}`, {
        credentials: "include",
      });

      const { result } = await response.json();
      return result;
    },
  });

export const useRelatedProducts = (
  productId: string,
  params: UseProductsParams = { page: 1, limit: 10 }
) =>
  useQuery<PaginatedResponse<ProductType>>({
    queryKey: queryKeys.product.related(productId, params),

    queryFn: async () => {
      const queryParams = Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([key, value]) => [key, String(value)]);

      const query = new URLSearchParams(queryParams);

      const response = await fetch(
        `/api/products/related/${productId}?${query}`,
        {
          credentials: "include",
        }
      );

      const data = await response.json();
      return data;
    },

    enabled: !!productId,
  });

export const useProduct = (productId: string) =>
  useQuery<ProductType>({
    queryKey: queryKeys.product.detail(productId),

    queryFn: async () => {
      const response = await fetch(`/api/products/${productId}`, {
        credentials: "include",
      });

      const { result } = await response.json();
      return result;
    },

    enabled: !!productId,
  });
