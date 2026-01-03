import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { errorResponse } from "@/utils/api/api-response";
import { fetchFromApi } from "@/utils/api/fetch-from-api";

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
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;

  if (!accessToken) {
    return errorResponse({ status: 401, message: "Missing token" });
  }

  const queryString = req.nextUrl.searchParams.toString();
  const result = await fetchFromApi(`/payment/vnpay/return?${queryString}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!result?.orderId || !result?.status) {
    return redirectToCart(req, {
      status: "failed",
      orderId: result.orderId,
      vnpResponseCode: result.vnpResponseCode,
    });
  }

  return redirectToCart(req, {
    status: result.status,
    orderId: result.orderId,
    vnpResponseCode: result.vnpResponseCode,
  });
};
