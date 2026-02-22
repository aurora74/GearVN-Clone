import { useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "../query-keys";
import { toastError, toastSuccess } from "@/components/ui/toaster";
import { getCsrfHeaders } from "@/utils/api/csrf";

export const useUpload = () => {
  return useMutation<string[], Error, File[]>({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));

      const response = await fetch(`/api/chat/upload`, {
        method: "POST",
        headers: getCsrfHeaders(),
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
      const res = await fetch(`/api/chat/${userId}`, {
        method: "DELETE",
        headers: getCsrfHeaders(),
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

export const useDeleteMessages = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userIds: string[]) => {
      const res = await fetch(`/api/chat`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...getCsrfHeaders() },
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

export const useResolveChatTicket = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roomId: string) => {
      const response = await fetch(`/api/chat/room/${roomId}/resolve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCsrfHeaders() },
        body: JSON.stringify({}),
      });

      const data = await response.json();
      if (!response.ok) throw data;
      return data.result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.supportTicket.root });
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.root });
      toastSuccess("Đã giải quyết yêu cầu", "Cuộc trò chuyện đã được cập nhật.");
      onSuccessCallback?.();
    },
    onError: (err: any) => {
      toastError(err?.message, err?.description);
    },
  });
};
