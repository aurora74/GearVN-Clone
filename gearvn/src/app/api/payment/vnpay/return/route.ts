import { NextRequest, NextResponse } from "next/server";

import { fetchFromApi } from "@/utils/api/fetch-from-api";

type ReturnStatus = "success" | "pending" | "failed";

const normalizeReturnStatus = (status: string | undefined): ReturnStatus => {
  if (status === "success") return "success";
  if (status === "pending") return "pending";
  return "failed";
};

const redirectToCart = (
  req: NextRequest,
  params: Record<string, string | undefined>
) => {
  const url = new URL("/cart", req.nextUrl.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      if (key === "orderId") {
        value = Buffer.from(value).toString("base64");
      }
      url.searchParams.set(key, value);
    }
  });
  return NextResponse.redirect(url.toString());
};

export const GET = async (req: NextRequest) => {
  const queryString = req.nextUrl.searchParams.toString();

  try {
    const result = await fetchFromApi(`/payment/vnpay/return?${queryString}`, {
      method: "GET",
    });

    if (!result?.orderId) {
      return redirectToCart(req, {
        status: "failed",
        vnpResponseCode: result?.vnpResponseCode,
      });
    }

    return redirectToCart(req, {
      status: normalizeReturnStatus(result?.status),
      orderId: result.orderId,
      vnpResponseCode: result.vnpResponseCode,
    });
  } catch (err: any) {
    return redirectToCart(req, {
      status: "failed",
      vnpResponseCode: err?.detail?.vnpResponseCode,
    });
  }
};
