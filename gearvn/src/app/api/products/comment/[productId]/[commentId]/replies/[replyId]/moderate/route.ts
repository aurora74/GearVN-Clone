import { NextRequest } from "next/server";

import { proxyJsonModeration } from "../../../../../_utils";

export const POST = async (
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ productId: string; commentId: string; replyId: string }>;
  }
) => {
  const { productId, commentId, replyId } = await params;

  return proxyJsonModeration({
    req,
    endpoint: `/products/comment/${productId}/${commentId}/replies/${replyId}/moderate`,
    successMessage: "Cập nhật kiểm duyệt thành công",
  });
};
