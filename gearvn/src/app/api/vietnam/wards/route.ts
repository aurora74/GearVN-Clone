import { NextRequest } from "next/server";

import { fetchFromApi } from "@/utils/api/fetch-from-api";
import { successResponse, errorResponse } from "@/utils/api/api-response";

export async function GET(req: NextRequest) {
  try {
    const districtCode = req.nextUrl.searchParams.get("districtCode");

    if (!districtCode) {
      return errorResponse({
        status: 400,
        message: "Missing district code",
      });
    }

    const result = await fetchFromApi(
      `https://provinces.open-api.vn/api/d/${districtCode}?depth=2`,
      { method: "GET" }
    );

    return successResponse({
      message: "Lấy danh sách phường/xã thành công",
      result: result.wards,
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
