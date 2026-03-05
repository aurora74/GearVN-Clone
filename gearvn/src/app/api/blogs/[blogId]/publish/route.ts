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

export const PATCH = async (
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

    const result = await fetchFromApi(`/blogs/${blogId}/publish`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return successResponse({
      message: "Xuất bản thành công",
      description: "Bài viết đã được hiển thị công khai.",
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
