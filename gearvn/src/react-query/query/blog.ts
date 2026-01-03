import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "../query-keys";

import { PaginatedResponse } from "@/types/global";
import { BlogType, UseBlogsParams } from "@/types/blog";

export const useBlogs = (params: UseBlogsParams = { page: 1, limit: 10 }) =>
  useQuery<PaginatedResponse<BlogType>>({
    queryKey: queryKeys.blog.list(params),

    queryFn: async () => {
      const queryParams = Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([key, value]) => [key, String(value)]);

      const query = new URLSearchParams(queryParams);

      const response = await fetch(`/api/blogs?${query}`, {
        credentials: "include",
      });

      const { result } = await response.json();
      return result;
    },
  });

export const useRelatedBlogs = (blogId: string) =>
  useQuery<PaginatedResponse<BlogType>>({
    queryKey: queryKeys.blog.related(blogId),

    enabled: !!blogId,
    queryFn: async () => {
      const response = await fetch(`/api/blogs/related/${blogId}`, {
        credentials: "include",
      });

      const { result } = await response.json();
      return result;
    },
  });

export const useBlog = (id: string) =>
  useQuery<BlogType>({
    queryKey: queryKeys.blog.detail(id),

    queryFn: async () => {
      const response = await fetch(`/api/blogs/${id}`, {
        credentials: "include",
      });

      const { result } = await response.json();
      return result;
    },

    enabled: !!id,
  });
