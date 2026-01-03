import { NextRequest, NextResponse } from "next/server";

import { setCookie } from "@/utils/api/cookies";

export const GET = (req: NextRequest) => {
  const { searchParams } = new URL(req.url);

  const accessToken = searchParams.get("accessToken");
  const refreshToken = searchParams.get("refreshToken");

  if (!accessToken || !refreshToken) {
    return NextResponse.json({ message: "Missing tokens" }, { status: 400 });
  }

  const res = NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/`, {
    status: 302,
  });

  setCookie(res, "accessToken", accessToken, 60 * 60 * 24);
  setCookie(res, "refreshToken", refreshToken, 60 * 60 * 24 * 3);

  return res;
};
