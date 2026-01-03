import { fetchFromApi } from "@/utils/api/fetch-from-api";
import { successResponse, errorResponse } from "@/utils/api/api-response";

export async function GET() {
  try {
    const result = await fetchFromApi("https://provinces.open-api.vn/api/p/", {
      method: "GET",
    });

    return successResponse({
      message: "Lấy danh sách tỉnh/thành phố thành công",
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
