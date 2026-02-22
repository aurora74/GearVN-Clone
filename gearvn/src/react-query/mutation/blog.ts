import { useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "../query-keys";
import {
  CreateBlogCommentPayload,
  CreateBlogPayload,
  UpdateBlogPayload,
} from "@/types/blog";
import { getCsrfHeaders } from "@/utils/api/csrf";

import { toastError, toastSuccess } from "@/components/ui/toaster";

export const useCreateBlog = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateBlogPayload) => {
      const formData = new FormData();
      formData.append("title", payload.title);
      formData.append("slug", payload.slug);
      formData.append("summary", payload.summary);
      formData.append("description", payload.description);
      formData.append("thumbnail", payload.thumbnail);

      const res = await fetch("/api/blogs", {
        method: "POST",
        headers: getCsrfHeaders(),
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw data;
      return data;
    },

    onSuccess: (data) => {
      toastSuccess(data.message, data.description);
      queryClient.invalidateQueries({ queryKey: queryKeys.blog.root });
      onSuccessCallback?.();
    },

    onError: (err: any) => {
      toastError(err.message, err.description);
    },
  });
};

export const useUpdateBlog = (
  blogId: string,
  onSuccessCallback?: () => void
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateBlogPayload) => {
      const formData = new FormData();
      formData.append("title", payload.title);
      formData.append("slug", payload.slug);
      formData.append("summary", payload.summary);
      formData.append("description", payload.description);

      if (payload.thumbnail instanceof File) {
        formData.append("thumbnail", payload.thumbnail);
      }

      const res = await fetch(`/api/blogs/${blogId}`, {
        method: "PUT",
        headers: getCsrfHeaders(),
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw data;
      return data;
    },

    onSuccess: (data) => {
      toastSuccess(data.message, data.description);
      queryClient.invalidateQueries({ queryKey: queryKeys.blog.root });
      onSuccessCallback?.();
    },

    onError: (err: any) => {
      toastError(err.message, err.description);
    },
  });
};

export const useDeleteBlog = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (blogId: string) => {
      const res = await fetch(`/api/blogs/${blogId}`, {
        method: "DELETE",
        headers: getCsrfHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw data;
      return data;
    },

    onSuccess: (data) => {
      toastSuccess(data.message, data.description);
      queryClient.invalidateQueries({ queryKey: queryKeys.blog.root });
      onSuccessCallback?.();
    },

    onError: (err: any) => {
      toastError(err.message, err.description);
    },
  });
};

export const useCreateBlogComment = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateBlogCommentPayload) => {
      const res = await fetch(`/api/blogs/${payload.blogId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCsrfHeaders(),
        },
        body: JSON.stringify({ content: payload.content }),
      });
      const data = await res.json();
      if (!res.ok) throw data;
      return data;
    },

    onSuccess: (data, variables) => {
      toastSuccess(data.message, data.description);
      queryClient.invalidateQueries({
        queryKey: queryKeys.blog.comments(variables.blogId),
      });
      onSuccessCallback?.();
    },

    onError: (err: any) => {
      toastError(err.message, err.description);
    },
  });
};

export const usePublishBlog = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (blogId: string) => {
      const res = await fetch(`/api/blogs/${blogId}/publish`, {
        method: "PATCH",
        headers: getCsrfHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw data;
      return data;
    },

    onSuccess: (data) => {
      toastSuccess(data.message, data.description);
      queryClient.invalidateQueries({ queryKey: queryKeys.blog.root });
      onSuccessCallback?.();
    },

    onError: (err: any) => {
      toastError(err.message, err.description);
    },
  });
};

export const useUnpublishBlog = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (blogId: string) => {
      const res = await fetch(`/api/blogs/${blogId}/unpublish`, {
        method: "PATCH",
        headers: getCsrfHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw data;
      return data;
    },

    onSuccess: (data) => {
      toastSuccess(data.message, data.description);
      queryClient.invalidateQueries({ queryKey: queryKeys.blog.root });
      onSuccessCallback?.();
    },

    onError: (err: any) => {
      toastError(err.message, err.description);
    },
  });
};

export const useModerateBlogComment = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      blogId: string;
      commentId: string;
      action: "hide" | "delete";
      reason: string;
    }) => {
      const res = await fetch(
        `/api/blogs/${payload.blogId}/comments/${payload.commentId}/moderate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getCsrfHeaders() },
          body: JSON.stringify({ action: payload.action, reason: payload.reason }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw data;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.blog.comments(variables.blogId) });
      onSuccessCallback?.();
    },
    onError: (err: any) => toastError(err.message, err.description),
  });
};
