import { QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "../query-keys";
import { CreateEventPayload, UpdateEventPayload } from "@/types/event";
import { getCsrfHeaders } from "@/utils/api/csrf";

import { toastError, toastSuccess } from "@/components/ui/toaster";

const invalidateEventPromotionCaches = (
  queryClient: QueryClient,
  eventId?: string
) => {
  queryClient.invalidateQueries({ queryKey: queryKeys.event.root });
  queryClient.invalidateQueries({ queryKey: queryKeys.product.root });
  queryClient.invalidateQueries({ queryKey: queryKeys.promotion.summary });

  if (eventId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.event.detail(eventId) });
  }
};

const appendEventWindowFields = (
  formData: FormData,
  payload: CreateEventPayload | UpdateEventPayload
) => {
  if (payload.startsAt) formData.append("startsAt", payload.startsAt);
  if (payload.endsAt) formData.append("endsAt", payload.endsAt);
  if (payload.isEnabled !== undefined) {
    formData.append("isEnabled", String(payload.isEnabled));
  }
  if ("reason" in payload && payload.reason) {
    formData.append("reason", payload.reason);
  }
};

const parseEventResponse = async (response: Response) => {
  const data = await response.json();
  if (!response.ok) throw data;
  return data;
};

export const useCreateEvent = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateEventPayload) => {
      const formData = new FormData();
      formData.append("name", payload.name);
      formData.append("tag", payload.tag);
      formData.append("frame", payload.frame);
      appendEventWindowFields(formData, payload);

      if (payload.image instanceof File) {
        formData.append("image", payload.image);
      }

      const res = await fetch("/api/events", {
        method: "POST",
        headers: getCsrfHeaders(),
        body: formData,
      });

      return parseEventResponse(res);
    },

    onSuccess: (data) => {
      toastSuccess(data.message, data.description);
      invalidateEventPromotionCaches(queryClient, data?.result?._id);
      onSuccessCallback?.();
    },

    onError: (err: any) => {
      toastError(err?.message, err?.description);
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
      if (payload.frame instanceof File) formData.append("frame", payload.frame);
      if (payload.image instanceof File) formData.append("image", payload.image);
      appendEventWindowFields(formData, payload);

      const res = await fetch(`/api/events/${payload.id}`, {
        method: "PUT",
        headers: getCsrfHeaders(),
        body: formData,
      });

      return parseEventResponse(res);
    },

    onSuccess: (data, variables) => {
      toastSuccess(data.message, data.description);
      invalidateEventPromotionCaches(queryClient, variables.id);
      onSuccessCallback?.();
    },

    onError: (err: any) => {
      toastError(err?.message, err?.description);
    },
  });
};

export const useDeleteEvent = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: string | { id: string; reason?: string }) => {
      const payload = typeof variables === "string" ? { id: variables } : variables;
      const res = await fetch(`/api/events/${payload.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...getCsrfHeaders() },
        body: JSON.stringify({ reason: payload.reason }),
      });

      return parseEventResponse(res);
    },

    onSuccess: (data, variables) => {
      const eventId = typeof variables === "string" ? variables : variables.id;
      toastSuccess(data.message, data.description);
      invalidateEventPromotionCaches(queryClient, eventId);
      onSuccessCallback?.();
    },

    onError: (err: any) => {
      toastError(err?.message, err?.description);
    },
  });
};

const useEventLifecycleMutation = (
  action: "enable" | "disable" | "end",
  onSuccessCallback?: () => void
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await fetch(`/api/events/${id}/${action}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCsrfHeaders() },
        body: JSON.stringify({ reason }),
      });

      return parseEventResponse(res);
    },

    onSuccess: (data, variables) => {
      toastSuccess(data.message, data.description);
      invalidateEventPromotionCaches(queryClient, variables.id);
      onSuccessCallback?.();
    },

    onError: (err: any) => {
      toastError(err?.message, err?.description);
    },
  });
};

export const useEnableEvent = (onSuccessCallback?: () => void) =>
  useEventLifecycleMutation("enable", onSuccessCallback);

export const useDisableEvent = (onSuccessCallback?: () => void) =>
  useEventLifecycleMutation("disable", onSuccessCallback);

export const useEndEvent = (onSuccessCallback?: () => void) =>
  useEventLifecycleMutation("end", onSuccessCallback);
