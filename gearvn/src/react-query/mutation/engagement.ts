import { useMutation, useQueryClient } from "@tanstack/react-query";

import { toastError, toastSuccess } from "@/components/ui/toaster";
import { getCsrfHeaders } from "@/utils/api/csrf";
import { queryKeys } from "../query-keys";
import {
  AddProductQuestionCommentPayload,
  AnswerProductQuestionPayload,
  CreateProductQuestionPayload,
  UpdateSupportTicketStatusPayload,
} from "@/types/engagement";

const toQuestionFormData = ({
  content,
  images,
}: {
  content: string;
  images?: File[];
}) => {
  const formData = new FormData();
  formData.append("content", content);
  images?.forEach((file) => formData.append("images", file));
  return formData;
};

export const useCreateProductQuestion = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateProductQuestionPayload) => {
      const response = await fetch(
        `/api/product-questions/product/${payload.productId}`,
        {
          method: "POST",
          headers: getCsrfHeaders(),
          body: toQuestionFormData(payload),
        }
      );

      const data = await response.json();
      if (!response.ok) throw data;
      return data.result;
    },
    onSuccess: (data, variables) => {
      const question = data?.question ?? data;
      if (question?.productId) {
        queryClient.setQueryData(
          queryKeys.productQuestion.byProduct(question.productId),
          (current: unknown) => {
            if (!Array.isArray(current)) return [question];
            return current.some((item: any) => item.id === question.id)
              ? current
              : [question, ...current];
          }
        );
      }
      queryClient.invalidateQueries({
        queryKey: queryKeys.productQuestion.byProduct(variables.productId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.supportTicket.root });
      toastSuccess("Gửi câu hỏi thành công", "Câu hỏi đã được ghi nhận.");
      onSuccessCallback?.();
    },
    onError: (err: any) => {
      toastError(err?.message, err?.description);
    },
  });
};

export const useAddProductQuestionComment = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AddProductQuestionCommentPayload) => {
      const response = await fetch(
        `/api/product-questions/${payload.questionId}/comments`,
        {
          method: "POST",
          headers: getCsrfHeaders(),
          body: toQuestionFormData(payload),
        }
      );

      const data = await response.json();
      if (!response.ok) throw data;
      return data.result;
    },
    onSuccess: (question) => {
      if (question?.productId) {
        queryClient.setQueryData(
          queryKeys.productQuestion.byProduct(question.productId),
          (current: unknown) =>
            Array.isArray(current)
              ? current.map((item: any) =>
                  item.id === question.id ? question : item
                )
              : current
        );
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.productQuestion.root });
      toastSuccess("Gửi phản hồi thành công", "Nội dung đã được cập nhật.");
      onSuccessCallback?.();
    },
    onError: (err: any) => {
      toastError(err?.message, err?.description);
    },
  });
};

export const useAnswerProductQuestion = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AnswerProductQuestionPayload) => {
      const response = await fetch(
        `/api/product-questions/${payload.questionId}/answers`,
        {
          method: "POST",
          headers: getCsrfHeaders(),
          body: toQuestionFormData(payload),
        }
      );

      const data = await response.json();
      if (!response.ok) throw data;
      return data.result;
    },
    onSuccess: (question) => {
      if (question?.productId) {
        queryClient.setQueryData(
          queryKeys.productQuestion.byProduct(question.productId),
          (current: unknown) =>
            Array.isArray(current)
              ? current.map((item: any) =>
                  item.id === question.id ? question : item
                )
              : current
        );
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.productQuestion.root });
      toastSuccess("Đã trả lời câu hỏi", "Phản hồi Moderator đã được đăng.");
      onSuccessCallback?.();
    },
    onError: (err: any) => {
      toastError(err?.message, err?.description);
    },
  });
};

export const useUpdateSupportTicketStatus = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateSupportTicketStatusPayload) => {
      const response = await fetch(
        `/api/support-tickets/${payload.ticketId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...getCsrfHeaders(),
          },
          body: JSON.stringify({ status: payload.status }),
        }
      );

      const data = await response.json();
      if (!response.ok) throw data;
      return data.result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.supportTicket.root });
      toastSuccess("Cập nhật yêu cầu thành công", "Trạng thái đã được thay đổi.");
      onSuccessCallback?.();
    },
    onError: (err: any) => {
      toastError(err?.message, err?.description);
    },
  });
};

export const useModerateProductQuestion = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      questionId: string;
      action: "hide" | "delete";
      reason: string;
    }) => {
      const response = await fetch(
        `/api/product-questions/${payload.questionId}/moderate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getCsrfHeaders() },
          body: JSON.stringify({ action: payload.action, reason: payload.reason }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw data;
      return data.result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.productQuestion.root });
      onSuccessCallback?.();
    },
    onError: (err: any) => toastError(err?.message, err?.description),
  });
};

export const useModerateProductQuestionComment = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      questionId: string;
      commentId: string;
      action: "hide" | "delete";
      reason: string;
    }) => {
      const response = await fetch(
        `/api/product-questions/${payload.questionId}/comments/${payload.commentId}/moderate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getCsrfHeaders() },
          body: JSON.stringify({ action: payload.action, reason: payload.reason }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw data;
      return data.result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.productQuestion.root });
      onSuccessCallback?.();
    },
    onError: (err: any) => toastError(err?.message, err?.description),
  });
};
