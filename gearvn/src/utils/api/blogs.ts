import { BlogType } from "@/types/blog";
import { PaginatedResponse } from "@/types/global";

export type BlogSort = "newest" | "oldest";

const BLOG_SORT_QUERY: Record<BlogSort, string> = {
  newest: "-createdAt",
  oldest: "createdAt",
};

export const fetchBlogs = async ({
  page = 1,
  limit = 10,
  search = "",
  sort = "newest",
}: {
  page?: number;
  limit?: number;
  search?: string;
  sort?: BlogSort;
} = {}): Promise<PaginatedResponse<BlogType>> => {
  try {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      sortBy: BLOG_SORT_QUERY[sort],
    });
    if (search) params.set("search", search);

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/blogs?${params.toString()}`,
      { next: { revalidate: 60 } }
    );

    if (!res.ok) return { data: [], page, limit, total: 0, totalPages: 0 };

    const { result } = await res.json();
    return result;
  } catch {
    return { data: [], page, limit, total: 0, totalPages: 0 };
  }
};

export const fetchRelatedBlogs = async (
  blogId: string
): Promise<BlogType[]> => {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/blogs/related/${blogId}`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return [];
    const { result } = await res.json();
    return result.data;
  } catch {
    return [];
  }
};

export const fetchBlog = async (slug: string): Promise<BlogType | null> => {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/blogs/slug/${slug}`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return null;
    const { result } = await res.json();
    return result;
  } catch {
    return null;
  }
};
