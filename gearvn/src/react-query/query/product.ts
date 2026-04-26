import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "../query-keys";

import { PaginatedResponse } from "@/types/global";
import { ProductType, UseProductsParams } from "@/types/product";

const parseResult = async <T>(response: Response): Promise<T> => {
  const data = await response.json();
  if (!response.ok) throw data;
  return data.result;
};

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

      return parseResult<PaginatedResponse<ProductType>>(response);
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

      return parseResult<ProductType>(response);
    },

    enabled: !!productId,
  });
