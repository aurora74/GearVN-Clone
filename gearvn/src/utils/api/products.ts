import { ProductType } from "@/types/product";
import { PaginatedResponse } from "@/types/global";

import { serializeFilters } from "../filters";

export const fetchProductsByEvent = async (tag: string) => {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/products?event=${tag}&limit=10`,
    {
      next: { revalidate: 60 },
    }
  );
  if (!res.ok) return [];
  const { result } = await res.json();
  return result?.data || [];
};

export const fetchProductsByCategory = async ({
  page = 1,
  limit = 30,
  search,
  filters,
  category,
}: {
  page?: number;
  limit?: number;
  search?: string;
  category: string;
  filters?: Record<string, string[]>;
}): Promise<PaginatedResponse<ProductType>> => {
  const params = new URLSearchParams();
  params.append("category", category);
  params.append("page", page.toString());
  params.append("limit", limit.toString());

  if (search) params.append("search", search);

  if (filters) {
    params.set("attributes", serializeFilters(filters));
  }

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/products?${params.toString()}`,
      { next: { revalidate: 60 } }
    );

    if (!response.ok) {
      return { data: [], page, limit, total: 0, totalPages: 0 };
    }

    const { result } = await response.json();
    return result;
  } catch {
    return { data: [], page, limit, total: 0, totalPages: 0 };
  }
};

export const fetchRelatedProducts = async (productId: string) => {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/products/related/${productId}?limit=10`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return [];
    const { result } = await res.json();
    return result.data;
  } catch {
    return [];
  }
};

export const fetchProduct = async (
  slug: string
): Promise<ProductType | null> => {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/products/slug/${slug}`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return null;
    const { result } = await res.json();
    return result;
  } catch {
    return null;
  }
};
