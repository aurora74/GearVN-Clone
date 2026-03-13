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

const mapCancelOrderError = (err: any) => {
  const status = err?.status || 500;

  if (status === 403) {
    return {
      status,
      message: "Không có quyền hủy đơn hàng",
      description: "Bạn chỉ có thể hủy đơn hàng của chính mình.",
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

  if (status === 409) {
    return {
      status,
      message: "Không thể hủy đơn hàng",
      description:
        err?.description ||
        "Đơn hàng đã thanh toán hoặc không còn ở trạng thái cho phép hủy.",
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

export const PUT = async (
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) => {
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

    const result = await fetchFromApi(`/orders/cancel/${orderId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return successResponse({
      message: "Hủy đơn hàng thành công",
      description: `Đơn hàng đã bị hủy.`,
      result,
    });
  } catch (err: any) {
    return errorResponse(mapCancelOrderError(err));
  }
};
