import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  CommentPayload,
  ReplyCommentPayload,
  CreateProductPayload,
  UpdateProductPayload,
  UseEditCommentParams,
  UseDeleteCommentParams,
} from "@/types/product";
import { queryKeys } from "@/react-query/query-keys";

import { toastError, toastSuccess } from "@/components/ui/toaster";

export const useCreateProduct = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateProductPayload) => {
      const formData = new FormData();

      data.images.forEach((file) => {
        formData.append("images", file);
      });

      formData.append("name", data.name);
      formData.append("slug", data.slug);
      formData.append("category", data.category);
      formData.append("price", data.price.toString());
      formData.append("stock", data.stock.toString());
      formData.append("attributes", JSON.stringify(data.attributes));

      if (data.event) formData.append("event", data.event);

      if (data.discountPrice !== undefined) {
        formData.append("discountPrice", data.discountPrice.toString());
      }

      if (data.discountPercent !== undefined) {
        formData.append("discountPercent", data.discountPercent.toString());
      }

      if (data.description) {
        formData.append("description", data.description);
      }

      const res = await fetch("/api/products", {
        method: "POST",
        body: formData,
      });

      const response = await res.json();
      if (!res.ok) throw response;

      return response;
    },

    onSuccess: (data) => {
      toastSuccess(data.message, data.description);
      queryClient.invalidateQueries({ queryKey: queryKeys.product.root });
      onSuccessCallback?.();
    },

    onError: (err: any) => {
      toastError(err.message, err.description);
    },
  });
};

export const useUpdateProduct = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateProductPayload) => {
      const formData = new FormData();

      const newImages = data.images.filter(
        (img) => img instanceof File
      ) as File[];

      const oldImages = data.images.filter(
        (img) => typeof img === "string"
      ) as string[];

      newImages.forEach((file) => {
        formData.append("images", file);
      });

      formData.append("name", data.name);
      formData.append("slug", data.slug);
      formData.append("category", data.category);
      formData.append("price", data.price.toString());
      formData.append("stock", data.stock.toString());
      formData.append("oldImages", JSON.stringify(oldImages));
      formData.append("attributes", JSON.stringify(data.attributes));

      if (data.event) formData.append("event", data.event);
      if (data.discountPrice !== undefined)
        formData.append("discountPrice", data.discountPrice.toString());
      if (data.discountPercent !== undefined)
        formData.append("discountPercent", data.discountPercent.toString());
      if (data.description) formData.append("description", data.description);

      const res = await fetch(`/api/products/${data.id}`, {
        method: "PUT",
        body: formData,
      });

      const response = await res.json();
      if (!res.ok) throw response;

      return response;
    },

    onSuccess: (data) => {
      toastSuccess(data.message, data.description);
      queryClient.invalidateQueries({ queryKey: queryKeys.product.root });
      onSuccessCallback?.();
    },

    onError: (err: any) => {
      toastError(err?.message, err?.description);
    },
  });
};

export const useDeleteProduct = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string) => {
      const res = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
      });

      const response = await res.json();
      if (!res.ok) throw response;

      return response;
    },

    onSuccess: (data) => {
      toastSuccess(data.message, data.description);
      queryClient.invalidateQueries({ queryKey: queryKeys.product.root });
      onSuccessCallback?.();
    },

    onError: (err: any) => {
      toastError(err?.message, err?.description);
    },
  });
};

export const useComment = (
  productId: string,
  onSuccessCallback?: () => void
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CommentPayload) => {
      const formData = new FormData();
      formData.append("content", body.content);
      formData.append("rating", body.rating.toString());

      if (body.images?.length) {
        body.images.forEach((file) => {
          formData.append("images", file);
        });
      }

      const res = await fetch(`/api/products/comment/${productId}`, {
        method: "POST",
        body: formData,
      });

      const response = await res.json();
      if (!res.ok) throw response;

      return response;
    },

    onSuccess: (data) => {
      toastSuccess(data.message, data.description);
      queryClient.invalidateQueries({ queryKey: queryKeys.product.root });
      onSuccessCallback?.();
    },

    onError: (err: any) => {
      toastError(err?.message, err?.description);
    },
  });
};

export const useToggleLikeComment = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productId,
      commentId,
    }: {
      productId: string;
      commentId: string;
    }) => {
      const res = await fetch(
        `/api/products/comment/${productId}/${commentId}/like`,
        { method: "POST" }
      );

      const response = await res.json();
      if (!res.ok) throw response;

      return response;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.product.root });
      onSuccessCallback?.();
    },

    onError: (err: any) => {
      toastError(err?.message, err?.description);
    },
  });
};

export const useReplyComment = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      productId: string;
      parentCommentId: string;
      body: ReplyCommentPayload;
    }) => {
      const { productId, parentCommentId, body } = params;

      const formData = new FormData();
      formData.append("content", body.content);

      if (body.images?.length) {
        body.images.forEach((file) => {
          formData.append("images", file);
        });
      }

      const res = await fetch(
        `/api/products/comment/${productId}/${parentCommentId}/reply`,
        {
          method: "POST",
          body: formData,
        }
      );

      const response = await res.json();
      if (!res.ok) throw response;

      return response;
    },

    onSuccess: (data) => {
      toastSuccess(data.message, data.description);
      queryClient.invalidateQueries({ queryKey: queryKeys.product.root });
      onSuccessCallback?.();
    },

    onError: (err: any) => {
      toastError(err?.message, err?.description);
    },
  });
};

export const useEditComment = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productId,
      commentId,
      body,
    }: UseEditCommentParams) => {
      const formData = new FormData();
      formData.append("content", body.content);

      const oldImages = body.images?.filter(
        (img) => typeof img === "string"
      ) as string[] | undefined;

      const newImages = body.images?.filter((img) => img instanceof File) as
        | File[]
        | undefined;

      newImages?.forEach((file) => formData.append("images", file));
      formData.append("oldImages", JSON.stringify(oldImages || []));

      const response = await fetch(
        `/api/products/comment/${productId}/${commentId}`,
        { method: "PUT", body: formData }
      );

      const result = await response.json();
      if (!response.ok) throw result;

      return result;
    },

    onSuccess: (data) => {
      toastSuccess(data.message, data.description);
      queryClient.invalidateQueries({ queryKey: queryKeys.product.root });
      onSuccessCallback?.();
    },

    onError: (err: any) => {
      toastError(err?.message, err?.description);
    },
  });
};

export const useDeleteComment = (onSuccessCallback?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, commentId }: UseDeleteCommentParams) => {
      const res = await fetch(
        `/api/products/comment/${productId}/${commentId}`,
        { method: "DELETE" }
      );
      const response = await res.json();
      if (!res.ok) throw response;

      return response;
    },

    onSuccess: (data) => {
      toastSuccess(data.message, data.description);
      queryClient.invalidateQueries({ queryKey: queryKeys.product.root });
      onSuccessCallback?.();
    },

    onError: (err: any) => {
      toastError(err?.message, err?.description);
    },
  });
};
