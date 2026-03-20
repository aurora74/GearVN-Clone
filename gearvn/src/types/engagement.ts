import { SUPPORT_TICKET_SOURCE, SUPPORT_TICKET_STATUS } from "@/config.global";

export type SupportTicketStatus =
  (typeof SUPPORT_TICKET_STATUS)[keyof typeof SUPPORT_TICKET_STATUS];

export type SupportTicketSource =
  (typeof SUPPORT_TICKET_SOURCE)[keyof typeof SUPPORT_TICKET_SOURCE];

export type ProductQuestionComment = {
  id: string;
  authorId: string;
  author?: {
    displayName: string;
    avatarUrl?: string;
  };
  authorRoleLabel: "Customer" | "Moderator";
  isModerator: boolean;
  content: string;
  images: string[];
  createdAt: string;
  moderationStatus?: "visible" | "hidden" | "deleted";
};

export type ProductQuestion = {
  id: string;
  productId: string;
  authorId: string;
  author: {
    displayName: string;
  };
  content: string;
  images: string[];
  comments: ProductQuestionComment[];
  publicStatus: "visible" | "hidden" | "deleted";
  moderationStatus?: "visible" | "hidden" | "deleted";
  ticketId?: string;
  createdAt: string;
  updatedAt: string;
};

export type SupportTicket = {
  _id: string;
  ticketCode: string;
  sourceType: SupportTicketSource;
  sourceId?: string;
  roomId?: string;
  customerId?:
    | string
    | {
        _id: string;
        fullName?: string;
        email?: string;
        avatarUrl?: string;
      };
  contextLabel: string;
  status: SupportTicketStatus;
  latestActivityAt: string;
  resolvedAt?: string | null;
  metadata?: {
    productId?: string;
    productSlug?: string;
    latestMessageId?: string;
    [key: string]: unknown;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type CreateProductQuestionPayload = {
  productId: string;
  content: string;
  images?: File[];
};

export type AddProductQuestionCommentPayload = {
  questionId: string;
  content: string;
  images?: File[];
};

export type AnswerProductQuestionPayload = AddProductQuestionCommentPayload;

export type SupportTicketListParams = {
  status?: SupportTicketStatus;
  page?: number;
  limit?: number;
};

export type UpdateSupportTicketStatusPayload = {
  ticketId: string;
  status: SupportTicketStatus;
};
