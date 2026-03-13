import { cookies } from "next/headers";
import { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/utils/api/api-response";
import { fetchFromApi } from "@/utils/api/fetch-from-api";

export const GET = async (
  _req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) => {
  try {
    const { ticketId } = await params;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return errorResponse({ status: 401, message: "Missing token" });
    }

    const result = await fetchFromApi(`/support-tickets/${ticketId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return successResponse({
      message: "Lấy chi tiết yêu cầu hỗ trợ thành công",
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
