import { NextRequest } from "next/server";
import type { NextResponse } from "next/server";

import { fetchFromApi } from "@/utils/api/fetch-from-api";
import { successResponse, errorResponse } from "@/utils/api/api-response";

export const dynamic = "force-dynamic";

const noStore = (response: NextResponse) => {
  response.headers.set("Cache-Control", "no-store");
  return response;
};

export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json();

    const result = await fetchFromApi("/vouchers/validate", {
      method: "POST",
      body,
      cache: "no-store",
    });

    return noStore(successResponse({
      message: "Kiểm tra voucher thành công",
      result,
    }));
  } catch (err: any) {
    return errorResponse({
      status: err.status || 500,
      message: "Voucher không hợp lệ",
      description: "Vui lòng kiểm tra lại mã voucher.",
      detail: err.detail ?? err.details?.detail ?? err.details,
    });
  }
};
