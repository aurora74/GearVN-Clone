import { NextRequest, NextResponse } from "next/server";

import { decode } from "jsonwebtoken";

import { TokenPayload } from "@/types/auth";
import { setCookie, setCsrfCookie } from "@/utils/api/cookies";
import { createCsrfToken } from "@/utils/api/csrf";

export const GET = (req: NextRequest) => {
  const { searchParams } = new URL(req.url);

  const accessToken = searchParams.get("accessToken");
  const refreshToken = searchParams.get("refreshToken");

  if (!accessToken || !refreshToken) {
    return NextResponse.json({ message: "Missing tokens" }, { status: 400 });
  }

  const decoded = decode(accessToken) as TokenPayload & { sub?: string };
  const sessionId = decoded?.sub;

  if (!sessionId) {
    return NextResponse.json({ message: "Invalid session" }, { status: 401 });
  }

  const res = NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/`, {
    status: 302,
  });

  const { signedToken } = createCsrfToken(sessionId);

  setCookie(res, "accessToken", accessToken, 60 * 60 * 24);
  setCookie(res, "refreshToken", refreshToken, 60 * 60 * 24 * 3);
  setCsrfCookie(res, signedToken, 60 * 60 * 24);

  return res;
};
