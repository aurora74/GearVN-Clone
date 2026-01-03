import { cookies } from "next/headers";
import { NextRequest } from "next/server";

import { fetchFromApi } from "@/utils/api/fetch-from-api";
import { successResponse, errorResponse } from "@/utils/api/api-response";

export const GET = async (req: NextRequest) => {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return errorResponse({ status: 401, message: "Missing token" });
    }

    const { searchParams } = new URL(req.url);
    const queryString = searchParams.toString();

    const result = await fetchFromApi(
      `/orders${queryString ? `?${queryString}` : ""}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    return successResponse({
      message: "Lấy danh sách đơn hàng thành công",
      description: "Dữ liệu đơn hàng đã được tải về.",
      result,
    });
  } catch (err: any) {
    return errorResponse({
      status: err.status || 500,
      message: "Lấy danh sách đơn hàng thất bại",
      description: "Vui lòng thử lại sau.",
      detail: err.detail,
    });
  }
};

export const POST = async (req: NextRequest) => {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return errorResponse({ status: 401, message: "Missing token" });
    }

    const body = await req.json();

    const result = await fetchFromApi("/orders", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body,
    });

    return successResponse({
      status: 201,
      message: "Tạo đơn hàng thành công",
      description: "Đơn hàng đã được ghi nhận trong hệ thống.",
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
