import { cookies } from "next/headers";
import { NextRequest } from "next/server";

import { fetchFromApi } from "@/utils/api/fetch-from-api";
import { successResponse, errorResponse } from "@/utils/api/api-response";

export const GET = async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const queryString = searchParams.toString();

    const result = await fetchFromApi(
      `/events${queryString ? `?${queryString}` : ""}`,
      { method: "GET" }
    );

    return successResponse({
      message: "Lấy danh sách sự kiện thành công",
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

export const POST = async (req: NextRequest) => {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return errorResponse({ status: 401, message: "Missing token" });
    }

    const formData = await req.formData();

    const result = await fetchFromApi("/events", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    return successResponse({
      status: 201,
      message: "Tạo sự kiện thành công",
      description: "Sự kiện đã được lưu vào hệ thống.",
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
