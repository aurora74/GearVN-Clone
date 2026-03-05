import { cookies } from "next/headers";
import { NextRequest } from "next/server";

import type { TokenPayload } from "@/types/auth";
import { fetchFromApi } from "@/utils/api/fetch-from-api";
import { validateCsrfRequest } from "@/utils/api/csrf";
import { successResponse, errorResponse } from "@/utils/api/api-response";

const decodeTokenPayload = (payload: string) => {
  const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
  const paddedPayload = normalizedPayload.padEnd(
    normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
    "="
  );

  return JSON.parse(atob(paddedPayload)) as TokenPayload & { sub?: string };
};

const getSessionId = (accessToken: string) => {
  const payload = accessToken.split(".")[1];

  if (!payload) {
    return undefined;
  }

  try {
    return decodeTokenPayload(payload).sub;
  } catch {
    return undefined;
  }
};

export const GET = async (
  req: NextRequest,
  { params }: { params: Promise<{ blogId: string }> }
) => {
  try {
    const blogId = (await params).blogId;
    const result = await fetchFromApi(`/blogs/${blogId}/comments`, {
      method: "GET",
    });

    return successResponse({
      message: "Lấy bình luận bài viết thành công",
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

export const POST = async (
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

    const sessionId = getSessionId(accessToken);

    if (!sessionId) {
      return errorResponse({ status: 401, message: "Invalid session" });
    }

    const csrfError = validateCsrfRequest(req, cookieStore, sessionId);

    if (csrfError) {
      return csrfError;
    }

    const body = await req.json();
    const result = await fetchFromApi(`/blogs/${blogId}/comments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body,
    });

    return successResponse({
      status: 201,
      message: "Đăng bình luận thành công",
      description: "Bình luận của bạn đã được hiển thị.",
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
