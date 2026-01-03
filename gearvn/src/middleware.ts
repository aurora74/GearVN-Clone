import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { USER_ROLE } from "./config.global";

const ADMIN_PATH = /^\/admin(\/|$)/;
const PROFILE_PATH = /^\/my-profile(\/|$)/;
const SETTINGS_PATH = /^\/settings(\/|$)/;

const SETTINGS_ROLE = USER_ROLE.CUSTOMER;

export const middleware = (req: NextRequest) => {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("accessToken")?.value;

  if (ADMIN_PATH.test(pathname)) {
    if (!token) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    const decoded = jwt.decode(token) as { role?: string } | null;
    if (!decoded || decoded.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (PROFILE_PATH.test(pathname)) {
    if (!token) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (SETTINGS_PATH.test(pathname)) {
    if (!token) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    const decoded = jwt.decode(token) as { role?: string } | null;
    if (!decoded || decoded.role !== SETTINGS_ROLE) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
};

export const config = {
  matcher: ["/admin/:path*", "/my-profile", "/settings/:path*"],
};
