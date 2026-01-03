import { cookies } from "next/headers";
import { NextRequest } from "next/server";

import { fetchFromApi } from "@/utils/api/fetch-from-api";
import { successResponse, errorResponse } from "@/utils/api/api-response";

export const POST = async (req: NextRequest) => {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return errorResponse({ status: 401, message: "Missing token" });
    }

    const body = await req.json();

    const result = await fetchFromApi("/payment/vnpay/create", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body,
    });

    return successResponse({
      message: "Tạo thanh toán VNPay thành công",
      description: "Thông tin thanh toán đã được tạo.",
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
