import { cookies } from "next/headers";

import { clearCookie } from "@/utils/api/cookies";
import { fetchFromApi } from "@/utils/api/fetch-from-api";
import { successResponse, errorResponse } from "@/utils/api/api-response";

export const POST = async () => {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;
    const refreshToken = cookieStore.get("refreshToken")?.value;

    if (!accessToken || !refreshToken) {
      return errorResponse({ status: 401, message: "Missing tokens" });
    }

    await fetchFromApi("/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const res = successResponse({
      message: "Đăng xuất thành công",
      description: "Bạn đã đăng xuất khỏi hệ thống.",
    });

    clearCookie(res, "accessToken");
    clearCookie(res, "refreshToken");

    return res;
  } catch (err: any) {
    return errorResponse({
      status: err.status || 500,
      message: "Đã có lỗi xảy ra",
      description: "Vui lòng thử lại sau.",
    });
  }
};
