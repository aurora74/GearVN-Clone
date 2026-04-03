import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

import { fetchFromApi } from "@/utils/api/fetch-from-api";
import { successResponse, errorResponse } from "@/utils/api/api-response";

export const dynamic = "force-dynamic";

const noStore = (response: NextResponse) => {
  response.headers.set("Cache-Control", "no-store");
  return response;
};

export const GET = async () => {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return errorResponse({ status: 401, message: "Missing token" });
    }

    const result = await fetchFromApi("/promotions/summary", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    return noStore(successResponse({
      message: "Lấy tổng quan khuyến mãi thành công",
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
