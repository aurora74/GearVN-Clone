import { useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "../query-keys";
import { CreateEventPayload, UpdateEventPayload } from "@/types/event";

import { toastError, toastSuccess } from "@/components/ui/toaster";

export const useCreateEvent = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateEventPayload) => {
      const formData = new FormData();
      formData.append("name", payload.name);
      formData.append("tag", payload.tag);
      formData.append("frame", payload.frame);

      if (payload.image instanceof File) {
        formData.append("image", payload.image);
      }

      const res = await fetch("/api/events", {
        method: "POST",
        body: formData,
      });

      const response = await res.json();
      if (!res.ok) throw response;
      return response;
    },

    onSuccess: (data) => {
      toastSuccess(data.message, data.description);
      queryClient.invalidateQueries({ queryKey: queryKeys.event?.root ?? [] });
      onSuccessCallback?.();
    },

    onError: (err: any) => {
      toastError(err.message, err.description);
    },
  });
};

export const useUpdateEvent = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateEventPayload) => {
      const formData = new FormData();

      if (payload.name) formData.append("name", payload.name);
      if (payload.tag) formData.append("tag", payload.tag);
      if (payload.frame instanceof File)
        formData.append("frame", payload.frame);
      if (payload.image instanceof File)
        formData.append("image", payload.image);

      const res = await fetch(`/api/events/${payload.id}`, {
        method: "PUT",
        body: formData,
      });

      const response = await res.json();
      if (!res.ok) throw response;
      return response;
    },

    onSuccess: (data) => {
      toastSuccess(data.message, data.description);
      queryClient.invalidateQueries({ queryKey: queryKeys.event?.root ?? [] });
      onSuccessCallback?.();
    },

    onError: (err: any) => {
      toastError(err.message, err.description);
    },
  });
};

export const useDeleteEvent = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventId: string) => {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "DELETE",
      });

      const response = await res.json();
      if (!res.ok) throw response;
      return response;
    },

    onSuccess: (data) => {
      toastSuccess(data.message, data.description);
      queryClient.invalidateQueries({
        queryKey: queryKeys.event?.root ?? [],
      });
      onSuccessCallback?.();
    },

    onError: (err: any) => {
      toastError(err.message, err.description);
    },
  });
};
