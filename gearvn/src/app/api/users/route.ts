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

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return errorResponse({ status: 401, message: "Missing token" });
    }

    const { searchParams } = new URL(req.url);
    const queryString = searchParams.toString();

    const result = await fetchFromApi(
      `/users${queryString ? `?${queryString}` : ""}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    return successResponse({
      message: "Lấy danh sách người dùng thành công",
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

export async function POST(req: NextRequest) {
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
    const { role, ...accountData } = body;
    let endpoint: "/users/managers" | "/users/staff";
    let payload = body;

    if (role === "MANAGER") {
      endpoint = "/users/managers";
      payload = accountData;
    } else if (
      ["PRODUCT_MARKETING_STAFF", "SALES_OPERATIONS_STAFF", "CSR"].includes(
        role
      )
    ) {
      endpoint = "/users/staff";
    } else {
      return errorResponse({ status: 400, message: "Unsupported account role" });
    }

    const result = await fetchFromApi(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: payload,
    });

    return successResponse({
      status: 201,
      message: "Tạo người dùng thành công",
      description: "Người dùng đã được thêm vào hệ thống.",
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
