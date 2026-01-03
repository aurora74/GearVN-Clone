import { NextRequest } from "next/server";

import { decode } from "jsonwebtoken";

import { TokenPayload } from "@/types/auth";

import { setCookie } from "@/utils/api/cookies";
import { fetchFromApi } from "@/utils/api/fetch-from-api";
import { successResponse, errorResponse } from "@/utils/api/api-response";

export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json();

    const data = await fetchFromApi("/auth/login", {
      method: "POST",
      body,
    });

    const decoded = decode(data.accessToken) as TokenPayload;
    const role = decoded.role;

    const res = successResponse({
      message: "Đăng nhập thành công",
      description: "Chào mừng bạn quay lại.",
      result: { role },
    });

    setCookie(res, "accessToken", data.accessToken, 60 * 60 * 24);
    setCookie(res, "refreshToken", data.refreshToken, 60 * 60 * 24 * 3);

    return res;
  } catch (err: any) {
    const status = err.status || 500;

    let message: string | undefined;
    let description: string | undefined;

    if (status === 400) {
      message = "Tài khoản chưa xác thực";
      description = "Vui lòng kiểm tra email để xác minh tài khoản.";
    } else if (status === 401) {
      message = "Đăng nhập thất bại";
      description = "Email hoặc mật khẩu không đúng.";
    } else if (status === 403) {
      message = "Tài khoản bị hạn chế";
      description =
        "Tài khoản của bạn đã bị ban hoặc bị khóa. Vui lòng liên hệ quản trị viên.";
    } else {
      message = "Đã có lỗi xảy ra";
      description = "Vui lòng thử lại sau.";
    }

    return errorResponse({ status, message, description });
  }
};
