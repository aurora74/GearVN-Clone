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
    return undefined;
  }
};

export const GET = async (
  _req: NextRequest,
  { params }: { params: Promise<{ voucherId: string }> }
) => {
  try {
    const voucherId = (await params).voucherId;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return errorResponse({ status: 401, message: "Missing token" });
    }

    const result = await fetchFromApi(`/vouchers/${voucherId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    return noStore(successResponse({
      message: "Lấy thông tin voucher thành công",
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

export const PATCH = async (
  req: NextRequest,
  { params }: { params: Promise<{ voucherId: string }> }
) => {
  try {
    const voucherId = (await params).voucherId;
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

    const result = await fetchFromApi(`/vouchers/${voucherId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` },
      body,
    });

    return noStore(successResponse({
      message: "Cập nhật voucher thành công",
      description: "Voucher đã được cập nhật.",
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

export const DELETE = async (
  req: NextRequest,
  { params }: { params: Promise<{ voucherId: string }> }
) => {
  try {
    const voucherId = (await params).voucherId;
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

    await fetchFromApi(`/vouchers/${voucherId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
      body,
    });

    return noStore(successResponse({
      message: "Xóa voucher thành công",
      description: "Voucher đã được xóa khỏi hệ thống.",
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
