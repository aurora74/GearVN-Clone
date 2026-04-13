import { PROMOTION_STATUS } from "@/config.global";

export type PromotionStatus =
  (typeof PROMOTION_STATUS)[keyof typeof PROMOTION_STATUS];

export type EventType = {
  _id: string;
  name: string;
  frame: string;
  tag: string;
  image?: string;
  startsAt?: string;
  endsAt?: string;
  isEnabled?: boolean;
  disabledAt?: string;
  status?: PromotionStatus;
  isArchived?: boolean;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type UseEventsParams = {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  tag?: string;
  visibility?: "all" | "active" | "unpublished" | "archived";
};

export type CreateEventPayload = {
  name: string;
  tag: string;
  frame: File;
  image?: File;
  startsAt?: string;
  endsAt?: string;
  isEnabled?: boolean;
};

export type UpdateEventPayload = {
  id: string;
  name?: string;
  tag?: string;
  frame?: File;
  image?: File;
  startsAt?: string;
  endsAt?: string;
  isEnabled?: boolean;
  reason?: string;
};
