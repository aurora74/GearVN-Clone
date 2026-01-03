import { NextRequest } from "next/server";

import { fetchFromApi } from "@/utils/api/fetch-from-api";
import { successResponse, errorResponse } from "@/utils/api/api-response";

export const GET = async (req: NextRequest) => {
  try {
    const token = req.nextUrl.searchParams.get("resetToken");
    if (!token) {
      return errorResponse({ status: 401, message: "Missing reset token" });
    }

    await fetchFromApi(
      `${process.env.API_BASE_URL}/auth/verify?token=${token}`,
      { method: "GET" }
    );

    return successResponse({
      message: "Yêu cầu đặt lại mật khẩu đã được xác minh",
      description: "Bây giờ bạn có thể đặt lại mật khẩu của mình.",
    });
  } catch (err: any) {
    if (err.status === 401) {
      return errorResponse({
        status: 401,
        message: "Đặt lại mật khẩu thất bại",
        description: "Liên kết không hợp lệ hoặc đã hết hạn.",
      });
    }

    return errorResponse({
      status: err.status || 500,
      message: "Đã có lỗi xảy ra",
      description: "Vui lòng thử lại sau.",
    });
  }
};
