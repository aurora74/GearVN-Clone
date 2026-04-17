import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import type { NextResponse } from "next/server";

import type { TokenPayload } from "@/types/auth";
import { fetchFromApi } from "@/utils/api/fetch-from-api";
import { validateCsrfRequest } from "@/utils/api/csrf";
import { successResponse, errorResponse } from "@/utils/api/api-response";

const noStore = (response: NextResponse) => {
  response.headers.set("Cache-Control", "no-store");
  return response;
};

const readJsonBody = async (req: NextRequest) => {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
};

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

    const sessionId = getSessionId(accessToken);

    if (!sessionId) {
      return errorResponse({ status: 401, message: "Invalid session" });
    }

    const csrfError = validateCsrfRequest(req, cookieStore, sessionId);

    if (csrfError) {
      return csrfError;
    }

    const formData = await req.formData();

    const result = await fetchFromApi(`/events/${eventId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    const cleanupAwareResult = {
      ...result,
      cleanupWarning: result?.cleanupWarning,
      cleanupFailedAssets: result?.cleanupFailedAssets,
    };

    return noStore(successResponse({
      message: "Cập nhật sự kiện thành công",
      description: "Sự kiện đã được cập nhật.",
      result: cleanupAwareResult,
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

    const sessionId = getSessionId(accessToken);

    if (!sessionId) {
      return errorResponse({ status: 401, message: "Invalid session" });
    }

    const csrfError = validateCsrfRequest(req, cookieStore, sessionId);

    if (csrfError) {
      return csrfError;
    }

    const body = await readJsonBody(req);

    await fetchFromApi(`/events/${eventId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
      body,
    });

    return noStore(successResponse({
      message: "Xóa sự kiện thành công",
      description: "Sự kiện đã được xóa khỏi hệ thống.",
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
