export type EventType = {
  _id: string;
  name: string;
  frame: string;
  tag: string;
  image?: string;
  createdAt: string;
  updatedAt: string;
};

export type UseEventsParams = {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  tag?: string;
};

export type CreateEventPayload = {
  name: string;
  tag: string;
  frame: File;
  image?: File;
};

export type UpdateEventPayload = {
  id: string;
  name?: string;
  tag?: string;
  frame?: File;
  image?: File;
};
