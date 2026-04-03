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

export const GET = async (req: NextRequest) => {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return errorResponse({ status: 401, message: "Missing token" });
    }

    const { searchParams } = new URL(req.url);
    const queryString = searchParams.toString();

    const result = await fetchFromApi(
      `/vouchers${queryString ? `?${queryString}` : ""}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      }
    );

    return noStore(successResponse({
      message: "Lấy danh sách voucher thành công",
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
    if (csrfError) return csrfError;

    const body = await req.json();

    const result = await fetchFromApi("/vouchers", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body,
    });

    return noStore(successResponse({
      status: 201,
      message: "Tạo voucher thành công",
      description: "Voucher đã được lưu vào hệ thống.",
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
