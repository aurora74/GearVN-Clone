import { NextRequest } from "next/server";

import { proxyJsonModeration } from "../../../_utils";

export const POST = async (
  req: NextRequest,
  { params }: { params: Promise<{ productId: string; commentId: string }> }
) => {
  const { productId, commentId } = await params;

  return proxyJsonModeration({
    req,
    endpoint: `/products/comment/${productId}/${commentId}/moderate`,
    successMessage: "Cập nhật kiểm duyệt thành công",
  });
};
