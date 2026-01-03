import { NextRequest } from "next/server";

import { fetchFromApi } from "@/utils/api/fetch-from-api";
import { successResponse, errorResponse } from "@/utils/api/api-response";

export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json();

    await fetchFromApi("/auth/register", {
      method: "POST",
      body,
    });

    return successResponse({
      status: 201,
      message: "Đăng ký thành công",
      description: "Vui lòng kiểm tra email để xác minh tài khoản.",
    });
  } catch (err: any) {
    if (err.status === 409) {
      return errorResponse({
        status: 409,
        message: "Email đã được đăng ký",
        description: "Vui lòng sử dụng email khác.",
      });
    }

    return errorResponse({
      status: err.status || 500,
      message: "Đã có lỗi xảy ra",
      description: "Vui lòng thử lại sau.",
    });
  }
};
