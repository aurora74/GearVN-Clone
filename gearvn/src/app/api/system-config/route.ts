import { cookies } from "next/headers";

import { fetchFromApi } from "@/utils/api/fetch-from-api";
import { successResponse, errorResponse } from "@/utils/api/api-response";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return errorResponse({ status: 401, message: "Missing token" });
    }

    const result = await fetchFromApi("/system-config", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return successResponse({
      message: "Lay cau hinh he thong thanh cong",
      result,
    });
  } catch (err: any) {
    return errorResponse({
      status: err.status || 500,
      message: "Da co loi xay ra",
      description: "Vui long thu lai sau.",
      detail: err.detail,
    });
  }
}
