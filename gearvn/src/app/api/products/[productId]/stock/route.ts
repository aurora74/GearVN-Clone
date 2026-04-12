import { cookies } from "next/headers";
import { NextRequest } from "next/server";

import { decode } from "jsonwebtoken";

import { TokenPayload } from "@/types/auth";
import { validateCsrfRequest } from "@/utils/api/csrf";
import { fetchFromApi } from "@/utils/api/fetch-from-api";
import { successResponse, errorResponse } from "@/utils/api/api-response";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const productId = (await params).productId;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return errorResponse({ status: 401, message: "Missing token" });
    }

    const decoded = decode(accessToken) as (TokenPayload & { sub?: string }) | null;
    const sessionId = decoded?.sub;

    if (!sessionId) {
      return errorResponse({ status: 401, message: "Invalid session" });
    }

    const csrfError = validateCsrfRequest(req, cookieStore, sessionId);
    if (csrfError) return csrfError;

    const { stock } = await req.json();
    const result = await fetchFromApi(`/products/${productId}/stock`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: { stock },
    });

    return successResponse({
      message: "Cập nhật tồn kho",
      description: "Số lượng tồn kho đã được cập nhật.",
      result,
    });
  } catch (err: any) {
    const backendError = err.details ?? err.detail;

    return errorResponse({
      status: err.status || 500,
      message: backendError?.message || "Đã có lỗi xảy ra",
      description: backendError?.description || "Vui lòng thử lại sau.",
      detail: backendError,
    });
  }
}
