import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  BUSINESS_ROLES,
  ROLE_LANDING_ROUTE,
  USER_ROLE,
  USER_ROLES,
} from "./config.global";
import type { UserRole } from "./types/user";

const ADMIN_PATH = /^\/admin(\/|$)/;
const PROFILE_PATH = /^\/my-profile(\/|$)/;
const SETTINGS_PATH = /^\/settings(\/|$)/;

const ADMIN_ACCESS_ROLES = [USER_ROLE.ADMIN, ...BUSINESS_ROLES] as const;
const SETTINGS_ROLE = USER_ROLE.CUSTOMER;

const getKnownRole = (token: string): UserRole | null => {
  const decoded = jwt.decode(token) as { role?: string } | null;

  if (!decoded?.role || !(USER_ROLES as readonly string[]).includes(decoded.role)) {
    return null;
  }

  return decoded.role as UserRole;
};

export const middleware = (req: NextRequest) => {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("accessToken")?.value;

  if (ADMIN_PATH.test(pathname)) {
    if (!token) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    const role = getKnownRole(token);
    if (!role || !ADMIN_ACCESS_ROLES.includes(role as (typeof ADMIN_ACCESS_ROLES)[number])) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    if (pathname === "/admin") {
      return NextResponse.redirect(new URL(ROLE_LANDING_ROUTE[role], req.url));
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
    const role = getKnownRole(token);
    if (role !== SETTINGS_ROLE) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
};

export const config = {
  matcher: ["/admin/:path*", "/my-profile", "/settings/:path*"],
};
