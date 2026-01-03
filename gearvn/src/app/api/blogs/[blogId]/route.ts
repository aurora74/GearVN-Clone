import { cookies } from "next/headers";
import { NextRequest } from "next/server";

import { fetchFromApi } from "@/utils/api/fetch-from-api";
import { successResponse, errorResponse } from "@/utils/api/api-response";

export const GET = async (
  req: NextRequest,
  { params }: { params: Promise<{ blogId: string }> }
) => {
  try {
    const blogId = (await params).blogId;

    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return errorResponse({ status: 401, message: "Missing token" });
    }

    const result = await fetchFromApi(`/blogs/${blogId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return successResponse({
      message: "Lấy bài viết thành công",
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

export const PUT = async (
  req: NextRequest,
  { params }: { params: Promise<{ blogId: string }> }
) => {
  try {
    const blogId = (await params).blogId;

    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return errorResponse({ status: 401, message: "Missing token" });
    }

    const formData = await req.formData();

    const result = await fetchFromApi(`/blogs/${blogId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    return successResponse({
      message: "Cập nhật thành công",
      description: "Bài viết đã được cập nhật.",
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
  { params }: { params: Promise<{ blogId: string }> }
) => {
  try {
    const blogId = (await params).blogId;

    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return errorResponse({ status: 401, message: "Missing token" });
    }

    await fetchFromApi(`/blogs/${blogId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return successResponse({
      message: "Xoá thành công",
      description: "Bài viết đã được xoá khỏi hệ thống.",
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
