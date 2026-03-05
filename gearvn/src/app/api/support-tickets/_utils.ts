import { cookies } from "next/headers";
import { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/utils/api/api-response";
import { validateCsrfRequest } from "@/utils/api/csrf";
import { fetchFromApi } from "@/utils/api/fetch-from-api";

export const getSessionId = (accessToken: string) => {
  try {
    const [, payload] = accessToken.split(".");
    if (!payload) return null;

    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as { sub?: string };

    return decoded.sub ?? null;
  } catch {
    return null;
  }
};

export const proxySupportTicketJsonMutation = async ({
  req,
  endpoint,
  method,
  successMessage,
  successDescription,
}: {
  req: NextRequest;
  endpoint: string;
  method: "PATCH" | "POST" | "DELETE";
  successMessage: string;
  successDescription?: string;
}) => {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return errorResponse({ status: 401, message: "Missing token" });
    }

    const sessionId = getSessionId(accessToken);
    if (!sessionId) {
      return errorResponse({ status: 401, message: "Invalid session" });
    }

    const csrfError = validateCsrfRequest(req, cookieStore, sessionId);
    if (csrfError) return csrfError;

    const body = await req.json();
    const result = await fetchFromApi(endpoint, {
      method,
      headers: { Authorization: `Bearer ${accessToken}` },
      body,
    });

    return successResponse({
      message: successMessage,
      description: successDescription,
      result,
    });
  } catch (err: any) {
    return errorResponse({
      status: err.status || 500,
      message: "Đã có lỗi xảy ra",
      description: "Vui lòng thử lại sau.",
      detail: err.detail ?? err.details?.detail ?? err.details,
    });
  }
};
