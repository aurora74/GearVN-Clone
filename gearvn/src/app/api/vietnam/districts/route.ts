import { NextRequest } from "next/server";

import { fetchFromApi } from "@/utils/api/fetch-from-api";
import { successResponse, errorResponse } from "@/utils/api/api-response";

export async function GET(req: NextRequest) {
  try {
    const provinceCode = req.nextUrl.searchParams.get("provinceCode");
    if (!provinceCode) {
      return errorResponse({ status: 400, message: "Missing province code" });
    }

    const result = await fetchFromApi(
      `https://provinces.open-api.vn/api/p/${provinceCode}?depth=2`,
      { method: "GET" }
    );

    return successResponse({
      message: "Lấy danh sách quận/huyện thành công",
      result: result.districts,
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
