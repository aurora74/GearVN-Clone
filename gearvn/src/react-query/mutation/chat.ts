import { useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "../query-keys";
import { toastError, toastSuccess } from "@/components/ui/toaster";

export const useUpload = () => {
  return useMutation<string[], Error, File[]>({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));

      const response = await fetch(`/api/chat/upload`, {
        method: "POST",
        body: formData,
      });

      const { result } = await response.json();
      if (!response.ok) throw result;

      return result;
    },

    onError: (err: any) => {
      toastError(err.message, err.description);
    },
  });
};

export const useDeleteMessage = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/chat/${userId}`, { method: "DELETE" });
      const response = await res.json();
      if (!res.ok) throw response;
      return response;
    },

    onSuccess: (data) => {
      toastSuccess(data.message, data.description);
      queryClient.invalidateQueries({
        queryKey: queryKeys.chat?.root ?? [],
      });
      onSuccessCallback?.();
    },

    onError: (err: any) => {
      toastError(err.message, err.description);
    },
  });
};

export const useDeleteMessages = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userIds: string[]) => {
      const res = await fetch(`/api/chat`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds }),
      });

      const response = await res.json();
      if (!res.ok) throw response;
      return response;
    },

    onSuccess: (data) => {
      toastSuccess(data.message, data.description);
      queryClient.invalidateQueries({
        queryKey: queryKeys.chat?.root ?? [],
      });
      onSuccessCallback?.();
    },

    onError: (err: any) => {
      toastError(err.message, err.description);
    },
  });
};
