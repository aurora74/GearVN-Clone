import { NextRequest } from "next/server";

import { proxyProductQuestionMutation } from "../../_utils";

export const POST = async (
  req: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) => {
  const { questionId } = await params;

  return proxyProductQuestionMutation({
    req,
    endpoint: `/product-questions/${questionId}/moderate`,
    bodyType: "json",
    successMessage: "Cập nhật kiểm duyệt thành công",
  });
};
