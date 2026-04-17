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

export const GET = async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const queryString = searchParams.toString();
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;
    const payload = accessToken?.split(".")[1];
    const decoded = payload ? decodeTokenPayload(payload) : null;
    const canUseManageRead = Boolean(accessToken && decoded?.role !== "CUSTOMER");
    const path = canUseManageRead ? "/events/manage" : "/events";

    const result = await fetchFromApi(
      `${path}${queryString ? `?${queryString}` : ""}`,
      {
        method: "GET",
        ...(canUseManageRead && accessToken
          ? { headers: { Authorization: `Bearer ${accessToken}` } }
          : {}),
      }
    );

    return successResponse({
      message: "Lấy danh sách sự kiện thành công",
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

export const POST = async (req: NextRequest) => {
  try {
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

    const result = await fetchFromApi("/events", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    return noStore(successResponse({
      status: 201,
      message: "Tạo sự kiện thành công",
      description: "Sự kiện đã được lưu vào hệ thống.",
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
