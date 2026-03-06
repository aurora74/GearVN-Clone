import { NextRequest } from "next/server";

import { proxyProductQuestionMutation } from "../../../../_utils";

export const POST = async (
  req: NextRequest,
  { params }: { params: Promise<{ questionId: string; commentId: string }> }
) => {
  const { questionId, commentId } = await params;

  return proxyProductQuestionMutation({
    req,
    endpoint: `/product-questions/${questionId}/comments/${commentId}/moderate`,
    bodyType: "json",
    successMessage: "Cập nhật kiểm duyệt thành công",
  });
};
