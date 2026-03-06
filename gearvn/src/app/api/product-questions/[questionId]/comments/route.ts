import { NextRequest } from "next/server";

import { proxyProductQuestionMutation } from "../../_utils";

export const POST = async (
  req: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) => {
  const { questionId } = await params;

  return proxyProductQuestionMutation({
    req,
    endpoint: `/product-questions/${questionId}/comments`,
    successMessage: "Gửi phản hồi thành công",
    successDescription: "Phản hồi đã được đăng.",
  });
};
