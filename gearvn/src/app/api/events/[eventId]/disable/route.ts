import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import type { NextResponse } from "next/server";

import { fetchFromApi } from "@/utils/api/fetch-from-api";
import { validateCsrfRequest } from "@/utils/api/csrf";
import { successResponse, errorResponse } from "@/utils/api/api-response";

const noStore = (response: NextResponse) => {
  response.headers.set("Cache-Control", "no-store");
  return response;
};

const getSessionId = (accessToken: string) => {
  try {
    const [, payload] = accessToken.split(".");
    if (!payload) return null;

    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as { sub?: string };

    return decoded.sub ?? null;
  } catch {
    return null;
  }
};

const readJsonBody = async (req: NextRequest) => {
  try {
    return await req.json();
  } catch {
    return {};
  }
};

export const PATCH = async (
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

    const sessionId = getSessionId(accessToken);

    if (!sessionId) {
      return errorResponse({ status: 401, message: "Invalid session" });
    }

    const csrfError = validateCsrfRequest(req, cookieStore, sessionId);
    if (csrfError) return csrfError;

    const body = await readJsonBody(req);

    const result = await fetchFromApi(`/events/${eventId}/disable`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` },
      body,
    });

    return noStore(successResponse({
      message: "Tắt sự kiện thành công",
      description: "Sự kiện đã được tắt.",
      result,
    }));
  } catch (err: any) {
    return errorResponse({
      status: err.status || 500,
      message: "Đã có lỗi xảy ra",
      description: "Vui lòng thử lại sau.",
      detail: err.detail ?? err.details?.detail ?? err.details,
    });
  }
};
