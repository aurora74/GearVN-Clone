import { NextRequest } from "next/server";

import { fetchFromApi } from "@/utils/api/fetch-from-api";
import { successResponse, errorResponse } from "@/utils/api/api-response";

export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json();

    await fetchFromApi("/auth/reset-password", {
      method: "POST",
      body,
    });

    return successResponse({
      status: 200,
      message: "Đặt lại mật khẩu thành công",
      description: "Bạn có thể đăng nhập bằng mật khẩu mới.",
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
