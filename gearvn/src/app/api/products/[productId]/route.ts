import { cookies } from "next/headers";
import { NextRequest } from "next/server";

import { decode } from "jsonwebtoken";

import { TokenPayload } from "@/types/auth";
import { fetchFromApi } from "@/utils/api/fetch-from-api";
import { successResponse, errorResponse } from "@/utils/api/api-response";
import { validateCsrfRequest } from "@/utils/api/csrf";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const productId = (await params).productId;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;
    const decoded = accessToken ? (decode(accessToken) as TokenPayload | null) : null;
    const canUseManageRead = Boolean(accessToken && decoded?.role !== "CUSTOMER");
    const path = canUseManageRead
      ? `/products/manage/${productId}`
      : `/products/${productId}`;

    const result = await fetchFromApi(
      path,
      canUseManageRead && accessToken
        ? { headers: { Authorization: `Bearer ${accessToken}` } }
        : undefined
    );

    return successResponse({
      message: "Lấy sản phẩm thành công",
      result,
    });
  } catch (err: any) {
    return errorResponse({
      status: err.status || 500,
      message: "Đã có lỗi xảy ra",
      description: "Vui lòng thử lại sau.",
      detail: err.detail,
    });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const productId = (await params).productId;

    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return errorResponse({ status: 401, message: "Missing token" });
    }

    const decoded = decode(accessToken) as (TokenPayload & { sub?: string }) | null;
    const sessionId = decoded?.sub;

    if (!sessionId) {
      return errorResponse({ status: 401, message: "Invalid session" });
    }

    const csrfError = validateCsrfRequest(req, cookieStore, sessionId);
    if (csrfError) return csrfError;

    const formData = await req.formData();

    const result = await fetchFromApi(`/products/${productId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    const cleanupAwareResult = {
      ...result,
      cleanupWarning: result?.cleanupWarning,
      cleanupFailedAssets: result?.cleanupFailedAssets,
    };

    return successResponse({
      message: "Cập nhật sản phẩm thành công",
      description: "Sản phẩm đã được cập nhật.",
      result: cleanupAwareResult,
    });
  } catch (err: any) {
    const backendError = err.details ?? err.detail;

    return errorResponse({
      status: err.status || 500,
      message: backendError?.message || "Đã có lỗi xảy ra",
      description: backendError?.description || "Vui lòng thử lại sau.",
      detail: backendError,
    });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const productId = (await params).productId;

    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken)
      return errorResponse({ status: 401, message: "Missing token" });

    const decoded = decode(accessToken) as (TokenPayload & { sub?: string }) | null;
    const sessionId = decoded?.sub;

    if (!sessionId) {
      return errorResponse({ status: 401, message: "Invalid session" });
    }

    const csrfError = validateCsrfRequest(req, cookieStore, sessionId);
    if (csrfError) return csrfError;

    await fetchFromApi(`/products/${productId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return successResponse({
      message: "Xoá sản phẩm thành công",
      description: "Sản phẩm đã được xoá khỏi hệ thống.",
    });
  } catch (err: any) {
    return errorResponse({
      status: err.status || 500,
      message: "Đã có lỗi xảy ra",
      description: "Vui lòng thử lại sau.",
      detail: err.detail,
    });
  }
}
