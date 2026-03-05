import { NextRequest } from "next/server";

import { proxyProductQuestionMutation } from "../../_utils";

export const POST = async (
  req: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) => {
  const { questionId } = await params;

  return proxyProductQuestionMutation({
    req,
    endpoint: `/product-questions/${questionId}/answers`,
    successMessage: "Trả lời câu hỏi thành công",
    successDescription: "Phản hồi Moderator đã được đăng.",
  });
};
