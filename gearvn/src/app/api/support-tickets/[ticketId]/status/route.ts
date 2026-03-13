import { NextRequest } from "next/server";

import { proxySupportTicketJsonMutation } from "../../_utils";

export const PATCH = async (
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) => {
  const { ticketId } = await params;

  return proxySupportTicketJsonMutation({
    req,
    endpoint: `/support-tickets/${ticketId}/status`,
    method: "PATCH",
    successMessage: "Cập nhật yêu cầu hỗ trợ thành công",
    successDescription: "Trạng thái yêu cầu đã được cập nhật.",
  });
};
