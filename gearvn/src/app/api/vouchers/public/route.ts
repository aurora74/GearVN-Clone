import { NextRequest } from "next/server";
import type { NextResponse } from "next/server";

import { fetchFromApi } from "@/utils/api/fetch-from-api";
import { successResponse, errorResponse } from "@/utils/api/api-response";

export const dynamic = "force-dynamic";

type PublicVoucher = {
  code?: string;
  discountType?: string;
  discountValue?: number;
  minimumOrderValue?: number;
  maximumDiscountAmount?: number | null;
  startsAt?: string | Date;
  endsAt?: string | Date;
  status?: string;
};

const noStore = (response: NextResponse) => {
  response.headers.set("Cache-Control", "no-store");
  return response;
};

const publicFieldsOnly = (voucher: PublicVoucher) => ({
  code: voucher.code,
  discountType: voucher.discountType,
  discountValue: voucher.discountValue,
  minimumOrderValue: voucher.minimumOrderValue,
  maximumDiscountAmount: voucher.maximumDiscountAmount,
  startsAt: voucher.startsAt,
  endsAt: voucher.endsAt,
  status: voucher.status,
});

export const GET = async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const queryString = searchParams.toString();

    const result = await fetchFromApi(
      `/vouchers/public${queryString ? `?${queryString}` : ""}`,
      { method: "GET", cache: "no-store" }
    );

    const vouchers = Array.isArray(result)
      ? result.map(publicFieldsOnly)
      : Array.isArray(result?.result)
        ? result.result.map(publicFieldsOnly)
        : result;

    return noStore(successResponse({
      message: "Lấy danh sách voucher công khai thành công",
      result: vouchers,
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
