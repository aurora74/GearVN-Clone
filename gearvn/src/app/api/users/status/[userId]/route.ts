import { cookies } from "next/headers";
import { NextRequest } from "next/server";

import { decode } from "jsonwebtoken";

import type { TokenPayload } from "@/types/auth";
import { fetchFromApi } from "@/utils/api/fetch-from-api";
import { validateCsrfRequest } from "@/utils/api/csrf";
import { successResponse, errorResponse } from "@/utils/api/api-response";

const getSessionId = (accessToken: string) => {
  const decoded = decode(accessToken) as (TokenPayload & { sub?: string }) | null;
  return decoded?.sub;
};

export async function PUT() {
  return errorResponse({
    status: 410,
    message: "Use PATCH /api/users/status/[userId] with reason",
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const userId = (await params).userId;

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
    if (csrfError) return csrfError;

    const body = await req.json();

    const result = await fetchFromApi(`/users/${userId}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` },
      body,
    });

    return successResponse({
      message: "Cập nhật trạng thái tài khoản thành công",
      description: "Trạng thái tài khoản đã được cập nhật.",
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
}
