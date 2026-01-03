import { useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "../query-keys";
import { CreateCategoryPayload, UpdateCategoryPayload } from "@/types/category";

import { toastError, toastSuccess } from "@/components/ui/toaster";

export const useCreateCategory = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateCategoryPayload) => {
      const formData = new FormData();
      formData.append("name", data.name);
      formData.append("label", data.label);
      formData.append("fields", JSON.stringify(data.fields));
      if (data.image instanceof File) formData.append("image", data.image);

      const res = await fetch("/api/categories", {
        method: "POST",
        body: formData,
      });
      const response = await res.json();
      if (!res.ok) throw response;
      return response;
    },

    onSuccess: (data) => {
      toastSuccess(data.message, data.description);
      queryClient.invalidateQueries({
        queryKey: queryKeys.category?.root ?? [],
      });
      onSuccessCallback?.();
    },

    onError: (err: any) => {
      toastError(err.message, err.description);
    },
  });
};

export const useUpdateCategory = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateCategoryPayload) => {
      const formData = new FormData();
      if (data.name) formData.append("name", data.name);
      if (data.label) formData.append("label", data.label);
      if (data.fields) formData.append("fields", JSON.stringify(data.fields));
      if (data.image instanceof File) formData.append("image", data.image);

      const res = await fetch(`/api/categories/${data.id}`, {
        method: "PUT",
        body: formData,
      });
      const response = await res.json();
      if (!res.ok) throw response;
      return response;
    },

    onSuccess: (data) => {
      toastSuccess(data.message, data.description);
      queryClient.invalidateQueries({
        queryKey: queryKeys.category?.root ?? [],
      });
      onSuccessCallback?.();
    },

    onError: (err: any) => {
      toastError(err.message, err.description);
    },
  });
};

export const useDeleteCategory = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      const response = await res.json();
      if (!res.ok) throw response;
      return response;
    },

    onSuccess: (data) => {
      toastSuccess(data.message, data.description);
      queryClient.invalidateQueries({
        queryKey: queryKeys.category?.root ?? [],
      });
      onSuccessCallback?.();
    },

    onError: (err: any) => {
      toastError(err.message, err.description);
    },
  });
};
