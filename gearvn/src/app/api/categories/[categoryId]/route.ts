import { cookies } from "next/headers";
import { NextRequest } from "next/server";

import { fetchFromApi } from "@/utils/api/fetch-from-api";
import { successResponse, errorResponse } from "@/utils/api/api-response";

export const PUT = async (
  req: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) => {
  try {
    const categoryId = (await params).categoryId;

    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return errorResponse({ status: 401, message: "Missing token" });
    }

    const formData = await req.formData();

    const result = await fetchFromApi(`/categories/${categoryId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    return successResponse({
      message: "Cập nhật danh mục thành công",
      description: "Danh mục đã được cập nhật.",
      result,
    });
  } catch (err: any) {
    return errorResponse({
      status: err.status || 500,
      message: "Lỗi hệ thống",
      description: "Vui lòng thử lại sau.",
      detail: err.detail,
    });
  }
};

export const DELETE = async (
  _req: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) => {
  try {
    const categoryId = (await params).categoryId;

    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return errorResponse({ status: 401, message: "Missing token" });
    }

    const result = await fetchFromApi(`/categories/${categoryId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return successResponse({
      message: "Xoá danh mục thành công",
      description: "Danh mục đã được xoá khỏi hệ thống.",
      result,
    });
  } catch (err: any) {
    return errorResponse({
      status: err.status || 500,
      message: "Lỗi hệ thống",
      description: "Vui lòng thử lại sau.",
      detail: err.detail,
    });
  }
};
