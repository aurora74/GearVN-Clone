import { cookies } from "next/headers";
import { NextRequest } from "next/server";

import { fetchFromApi } from "@/utils/api/fetch-from-api";
import { successResponse, errorResponse } from "@/utils/api/api-response";

export const GET = async (
  _req: NextRequest,
  { params }: { params: Promise<{ orderCode: string }> }
) => {
  try {
    const orderCode = (await params).orderCode;

    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return errorResponse({ status: 401, message: "Missing token" });
    }

    const result = await fetchFromApi(`/orders/code/${orderCode}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return successResponse({
      message: "Lấy đơn hàng theo code thành công",
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
