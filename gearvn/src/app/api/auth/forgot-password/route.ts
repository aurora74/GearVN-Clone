import { NextRequest } from "next/server";

import { fetchFromApi } from "@/utils/api/fetch-from-api";
import { successResponse, errorResponse } from "@/utils/api/api-response";

export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json();

    await fetchFromApi("/auth/forgot-password", {
      method: "POST",
      body,
    });

    return successResponse({
      message: "Đã gửi email đặt lại mật khẩu",
      description:
        "Vui lòng kiểm tra email và nhấp vào liên kết để đặt lại mật khẩu của bạn.",
    });
  } catch (err: any) {
    if (err.status === 404) {
      return errorResponse({
        status: 404,
        message: "Email chưa được đăng ký",
        description: "Không tìm thấy tài khoản với địa chỉ email này.",
      });
    }

    return errorResponse({
      status: err.status || 500,
      message: "Đã có lỗi xảy ra",
      description: "Vui lòng thử lại sau.",
    });
  }
};
