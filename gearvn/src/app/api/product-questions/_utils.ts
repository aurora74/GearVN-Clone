import { cookies } from "next/headers";
import { NextRequest } from "next/server";

import { fetchFromApi } from "@/utils/api/fetch-from-api";
import { validateCsrfRequest } from "@/utils/api/csrf";
import { errorResponse, successResponse } from "@/utils/api/api-response";

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

export const proxyProductQuestionMutation = async ({
  req,
  endpoint,
  method = "POST",
  successMessage,
  successDescription,
  bodyType = "form",
}: {
  req: NextRequest;
  endpoint: string;
  method?: "POST" | "PATCH" | "DELETE";
  successMessage: string;
  successDescription?: string;
  bodyType?: "form" | "json";
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

    const body = bodyType === "json" ? await req.json() : await req.formData();
    const result = await fetchFromApi(endpoint, {
      method,
      headers: { Authorization: `Bearer ${accessToken}` },
      body,
    });

    return successResponse({
      status: 201,
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
