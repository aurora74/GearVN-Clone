import crypto from "crypto";
import type { NextRequest, NextResponse } from "next/server";

type CookieStoreLike = {
  get(name: string): { value: string } | undefined;
};

const CSRF_COOKIE_NAME = "csrfToken";
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_ERROR_MESSAGE = "Phien thao tac da het han";
const CSRF_ERROR_DESCRIPTION = "Tai lai trang va thuc hien lai thao tac.";

const getCsrfSecret = () =>
  process.env.CSRF_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  process.env.JWT_SECRET ||
  "dev-csrf-secret";

const signToken = (rawToken: string, sessionId: string) => {
  return crypto
    .createHmac("sha256", getCsrfSecret())
    .update(`${sessionId}.${rawToken}`)
    .digest("base64url");
};

const invalidCsrfResponse = () =>
  Response.json(
    {
      message: CSRF_ERROR_MESSAGE,
      description: CSRF_ERROR_DESCRIPTION,
      detail: null,
    },
    { status: 403 }
  ) as NextResponse;

const safeEqual = (actual: string, expected: string) => {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  );
};

export const createCsrfToken = (sessionId: string) => {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const signature = signToken(rawToken, sessionId);

  return {
    rawToken,
    signedToken: `${rawToken}.${signature}`,
  };
};

export const validateCsrfRequest = (
  req: NextRequest,
  cookieStore: CookieStoreLike,
  sessionId: string
): NextResponse | null => {
  const cookieToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;
  const headerToken = req.headers.get(CSRF_HEADER_NAME);

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return invalidCsrfResponse();
  }

  const [rawToken, signature] = cookieToken.split(".");
  if (!rawToken || !signature) {
    return invalidCsrfResponse();
  }

  const expectedSignature = signToken(rawToken, sessionId);

  if (!safeEqual(signature, expectedSignature)) {
    return invalidCsrfResponse();
  }

  return null;
};

export const getCsrfHeaders = (): HeadersInit => {
  if (typeof document === "undefined") {
    return {};
  }

  const csrfCookie = document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${CSRF_COOKIE_NAME}=`));

  const token = csrfCookie?.slice(CSRF_COOKIE_NAME.length + 1);

  return token ? { [CSRF_HEADER_NAME]: decodeURIComponent(token) } : {};
};
