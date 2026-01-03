import { cookies } from "next/headers";
import { NextRequest } from "next/server";

import { fetchFromApi } from "@/utils/api/fetch-from-api";
import { successResponse, errorResponse } from "@/utils/api/api-response";

export const PUT = async (
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) => {
  try {
    const orderId = (await params).orderId;

    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return errorResponse({ status: 401, message: "Missing token" });
    }

    const body = await req.json();

    const result = await fetchFromApi(`/orders/status/${orderId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
      body,
    });

    return successResponse({
      message: "Cập nhật trạng thái thành công",
      description: `Đơn hàng đã chuyển sang trạng thái ${body.orderStatus}`,
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
