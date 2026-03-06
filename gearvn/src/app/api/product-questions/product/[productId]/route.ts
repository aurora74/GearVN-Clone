import { NextRequest } from "next/server";

import { fetchFromApi } from "@/utils/api/fetch-from-api";
import { errorResponse, successResponse } from "@/utils/api/api-response";
import { proxyProductQuestionMutation } from "../../_utils";

export const GET = async (
  _req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) => {
  try {
    const { productId } = await params;
    const result = await fetchFromApi(`/product-questions/product/${productId}`, {
      method: "GET",
    });

    return successResponse({
      message: "Lấy danh sách hỏi đáp sản phẩm thành công",
      result,
    });
  } catch (err: any) {
    return errorResponse({
      status: err.status || 500,
      message: "Đã có lỗi xảy ra",
      description: "Vui lòng thử lại sau.",
      detail: err.detail ?? err.details?.detail ?? err.details,
    });
  }
};

export const POST = async (
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) => {
  const { productId } = await params;

  return proxyProductQuestionMutation({
    req,
    endpoint: `/product-questions/product/${productId}`,
    successMessage: "Gửi câu hỏi thành công",
    successDescription: "Câu hỏi đã được gửi đến bộ phận hỗ trợ.",
  });
};
