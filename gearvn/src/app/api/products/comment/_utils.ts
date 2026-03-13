import { cookies } from "next/headers";
import { NextRequest } from "next/server";

import { fetchFromApi } from "@/utils/api/fetch-from-api";
import { validateCsrfRequest } from "@/utils/api/csrf";
import { errorResponse, successResponse } from "@/utils/api/api-response";

export const getSessionId = (accessToken: string) => {
  try {
    const [, payload] = accessToken.split(".");
    if (!payload) return null;
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).sub;
  } catch {
    return null;
  }
};

export const getAuthorizedMutationContext = async (req: NextRequest) => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;

  if (!accessToken) {
    return { error: errorResponse({ status: 401, message: "Missing token" }) };
  }

  const sessionId = getSessionId(accessToken);
  if (!sessionId) {
    return { error: errorResponse({ status: 401, message: "Invalid session" }) };
  }

  const csrfError = validateCsrfRequest(req, cookieStore, sessionId);
  if (csrfError) return { error: csrfError };

  return { accessToken };
};

export const proxyJsonModeration = async ({
  req,
  endpoint,
  successMessage,
}: {
  req: NextRequest;
  endpoint: string;
  successMessage: string;
}) => {
  try {
    const context = await getAuthorizedMutationContext(req);
    if ("error" in context) return context.error;

    const body = await req.json();
    const result = await fetchFromApi(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${context.accessToken}` },
      body,
    });

    return successResponse({ message: successMessage, result });
  } catch (err: any) {
    return errorResponse({
      status: err.status || 500,
      message: "Đã có lỗi xảy ra",
      description: "Vui lòng thử lại sau.",
      detail: err.detail ?? err.details?.detail ?? err.details,
    });
  }
};
