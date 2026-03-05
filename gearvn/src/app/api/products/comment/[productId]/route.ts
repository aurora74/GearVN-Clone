import { NextRequest } from "next/server";

import { fetchFromApi } from "@/utils/api/fetch-from-api";
import { successResponse, errorResponse } from "@/utils/api/api-response";
import { getAuthorizedMutationContext } from "../_utils";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const productId = (await params).productId;

    const context = await getAuthorizedMutationContext(req);
    if ("error" in context) return context.error;

    const formData = await req.formData();

    const result = await fetchFromApi(`/products/comment/${productId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${context.accessToken}` },
      body: formData,
    });

    return successResponse({
      status: 201,
      message: "Thêm bình luận thành công",
      description: "Cảm ơn bạn đã góp ý về sản phẩm!",
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
