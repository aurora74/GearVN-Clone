import { cookies } from "next/headers";
import { NextRequest } from "next/server";

import { fetchFromApi } from "@/utils/api/fetch-from-api";
import { successResponse, errorResponse } from "@/utils/api/api-response";

export const PUT = async (
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) => {
  try {
    const eventId = (await params).eventId;

    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return errorResponse({ status: 401, message: "Missing token" });
    }

    const formData = await req.formData();

    const result = await fetchFromApi(`/events/${eventId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    return successResponse({
      message: "Cập nhật sự kiện thành công",
      description: "Sự kiện đã được cập nhật.",
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

export const DELETE = async (
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) => {
  try {
    const eventId = (await params).eventId;

    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return errorResponse({ status: 401, message: "Missing token" });
    }

    await fetchFromApi(`/events/${eventId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return successResponse({
      message: "Xóa sự kiện thành công",
      description: "Sự kiện đã được xóa khỏi hệ thống.",
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
