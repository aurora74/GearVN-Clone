import { NextRequest } from "next/server";

import { fetchFromApi } from "@/utils/api/fetch-from-api";
import { successResponse, errorResponse } from "@/utils/api/api-response";
import { getAuthorizedMutationContext } from "../../_utils";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string; commentId: string }> }
) {
  try {
    const { productId, commentId } = await params;

    const context = await getAuthorizedMutationContext(req);
    if ("error" in context) return context.error;

    const formData = await req.formData();

    const result = await fetchFromApi(
      `/products/comment/${productId}/${commentId}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${context.accessToken}` },
        body: formData,
      }
    );

    return successResponse({
      status: 200,
      message: "Chỉnh sửa bình luận thành công",
      description: "Bình luận đã được cập nhật.",
      result,
    });
  } catch (err: any) {
    return errorResponse({
      status: err.status || 500,
      message: "Đã có lỗi xảy ra",
      description: "Vui lòng thử lại sau.",
      detail: err.detail,
    });
  }
}

export async function DELETE(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      productId: string;
      commentId: string;
      parentCommentId?: string;
    }>;
  }
) {
  try {
    const { productId, commentId, parentCommentId } = await params;

    const context = await getAuthorizedMutationContext(req);
    if ("error" in context) return context.error;

    const url = parentCommentId
      ? `/products/comment/${productId}/${parentCommentId}/reply/${commentId}`
      : `/products/comment/${productId}/${commentId}`;

    const result = await fetchFromApi(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${context.accessToken}` },
    });

    return successResponse({
      message: "Xóa bình luận thành công",
      description: "Bình luận đã được xóa.",
      result,
    });
  } catch (err: any) {
    return errorResponse({
      status: err.status || 500,
      message: "Đã có lỗi xảy ra",
      description: "Vui lòng thử lại sau.",
      detail: err.detail,
    });
  }
}
