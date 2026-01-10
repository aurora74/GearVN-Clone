import { NextResponse } from "next/server";

const DEFAULT_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

export const setCookie = (
  res: NextResponse,
  name: string,
  value?: string,
  maxAge: number = 60 * 60
) => {
  if (!value) return;

  res.cookies.set(name, value, {
    ...DEFAULT_COOKIE_OPTIONS,
    maxAge,
    httpOnly: true,
  });
};

export const setCsrfCookie = (
  res: NextResponse,
  value: string,
  maxAge: number = 60 * 60 * 24
) => {
  res.cookies.set("csrfToken", value, {
    ...DEFAULT_COOKIE_OPTIONS,
    maxAge,
    httpOnly: false,
  });
};

export const clearCookie = (res: NextResponse, name: string) => {
  res.cookies.set(name, "", {
    ...DEFAULT_COOKIE_OPTIONS,
    maxAge: 0,
    httpOnly: true,
  });
};

export const clearCsrfCookie = (res: NextResponse) => {
  res.cookies.set("csrfToken", "", {
    ...DEFAULT_COOKIE_OPTIONS,
    maxAge: 0,
    httpOnly: false,
  });
};
