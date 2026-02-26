import { NextRequest } from "next/server";

import { proxySupportTicketJsonMutation } from "@/app/api/support-tickets/_utils";

export const PATCH = async (
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) => {
  const { roomId } = await params;

  return proxySupportTicketJsonMutation({
    req,
    endpoint: `/chat/room/${roomId}/resolve`,
    method: "PATCH",
    successMessage: "Cập nhật yêu cầu hỗ trợ thành công",
    successDescription: "Trạng thái yêu cầu đã được cập nhật.",
  });
};
