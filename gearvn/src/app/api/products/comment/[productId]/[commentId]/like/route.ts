import { cookies } from "next/headers";
import { NextRequest } from "next/server";

import { fetchFromApi } from "@/utils/api/fetch-from-api";
import { successResponse, errorResponse } from "@/utils/api/api-response";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ productId: string; commentId: string }> }
) {
  try {
    const { productId, commentId } = await params;

    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return errorResponse({ status: 401, message: "Missing token" });
    }

    const result = await fetchFromApi(
      `/products/comment/${productId}/${commentId}/like`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    return successResponse({
      message: "Like thành công",
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
