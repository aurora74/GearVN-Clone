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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
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

    const result = await fetchFromApi(
      `/system-config/${encodeURIComponent(key)}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body,
      }
    );

    return successResponse({
      message: "Cap nhat cau hinh he thong thanh cong",
      description: "Cau hinh he thong da duoc cap nhat.",
      result,
    });
  } catch (err: any) {
    return errorResponse({
      status: err.status || 500,
      message: "Da co loi xay ra",
      description: "Vui long thu lai sau.",
      detail: err.detail,
    });
  }
}
