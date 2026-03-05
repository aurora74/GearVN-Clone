import { cookies } from "next/headers";
import { NextRequest } from "next/server";

import { fetchFromApi } from "@/utils/api/fetch-from-api";
import { successResponse, errorResponse } from "@/utils/api/api-response";
import { validateCsrfRequest } from "@/utils/api/csrf";

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

const mapOrderRouteError = (err: any, routeKind: "detail" | "update") => {
  const status = err?.status || 500;

  if (status === 403) {
    return {
      status,
      message: "Không có quyền truy cập đơn hàng",
      description:
        routeKind === "detail"
          ? "Bạn chỉ có thể xem đơn hàng của mình."
          : "Bạn không có quyền cập nhật đơn hàng này.",
      detail: err?.detail,
    };
  }

  if (status === 404) {
    return {
      status,
      message: "Không tìm thấy đơn hàng",
      description: "Đơn hàng không tồn tại hoặc đã bị xóa.",
      detail: err?.detail,
    };
  }

  return {
    status,
    message: err?.message || "Đã có lỗi xảy ra",
    description: err?.description || "Vui lòng thử lại sau.",
    detail: err?.detail,
  };
};

export const GET = async (
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) => {
  try {
    const orderId = (await params).orderId;

    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return errorResponse({ status: 401, message: "Missing token" });
    }

    const result = await fetchFromApi(`/orders/${orderId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return successResponse({
      message: "Lấy đơn hàng thành công",
      result,
    });
  } catch (err: any) {
    return errorResponse(mapOrderRouteError(err, "detail"));
  }
};

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const orderId = (await params).orderId;

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

    const result = await fetchFromApi(`/orders/${orderId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
      body,
    });

    return successResponse({
      message: "Cập nhật đơn hàng thành công",
      description: "Thông tin đơn hàng đã được cập nhật.",
      result,
    });
  } catch (err: any) {
    return errorResponse(mapOrderRouteError(err, "update"));
  }
}
