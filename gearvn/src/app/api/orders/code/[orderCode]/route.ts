import { cookies } from "next/headers";
import { NextRequest } from "next/server";

import { fetchFromApi } from "@/utils/api/fetch-from-api";
import { successResponse, errorResponse } from "@/utils/api/api-response";

const mapOrderCodeError = (err: any) => {
  const status = err?.status || 500;

  if (status === 401) {
    return {
      status,
      message: "Đăng nhập để tra cứu đơn hàng",
      description: "Đăng nhập để tra cứu đơn hàng của bạn.",
      detail: err?.detail,
    };
  }

  if (status === 403) {
    return {
      status,
      message: "Không có quyền truy cập đơn hàng",
      description: "Bạn chỉ có thể xem đơn hàng của mình.",
      detail: err?.detail,
    };
  }

  if (status === 404) {
    return {
      status,
      message: "Không tìm thấy đơn hàng",
      description: "Mã đơn hàng không tồn tại hoặc không thuộc tài khoản này.",
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
  { params }: { params: Promise<{ orderCode: string }> }
) => {
  try {
    const orderCode = (await params).orderCode;

    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return errorResponse(mapOrderCodeError({ status: 401 }));
    }

    const result = await fetchFromApi(`/orders/code/${orderCode}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return successResponse({
      message: "Lấy đơn hàng theo code thành công",
      result,
    });
  } catch (err: any) {
    return errorResponse(mapOrderCodeError(err));
  }
};
