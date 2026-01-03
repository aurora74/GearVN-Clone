import { useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "../query-keys";
import { CreateBlogPayload, UpdateBlogPayload } from "@/types/blog";

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

      const res = await fetch("/api/blogs", { method: "POST", body: formData });
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
      const res = await fetch(`/api/blogs/${blogId}`, { method: "DELETE" });
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
