import { NextRequest } from "next/server";

import { fetchFromApi } from "@/utils/api/fetch-from-api";
import { successResponse, errorResponse } from "@/utils/api/api-response";

export const GET = async (
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) => {
  try {
    const slug = (await params).slug;

    const result = await fetchFromApi(`/blogs/slug/${slug}`, {
      method: "GET",
    });

    return successResponse({
      status: 200,
      message: "Lấy bài viết thành công",
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
};
