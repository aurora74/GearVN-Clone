import { NextRequest } from "next/server";

import { fetchFromApi } from "@/utils/api/fetch-from-api";
import { successResponse, errorResponse } from "@/utils/api/api-response";

export const GET = async (
  _req: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) => {
  try {
    const category = (await params).category;

    const result = await fetchFromApi(`/categories/label/${category}`, {
      method: "GET",
    });

    return successResponse({
      message: "Lấy label thành công",
      result,
    });
  } catch (err: any) {
    return errorResponse({
      status: err.status || 500,
      message: "Lỗi hệ thống",
      description: "Vui lòng thử lại sau.",
      detail: err.detail,
    });
  }
};
