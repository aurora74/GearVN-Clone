export type Sender = "CUSTOMER" | "ADMIN" | string;

export type UserInfo = {
  _id: string;
  fullName: string;
  avatarUrl?: string;
};

export type User = {
  _id: string;
  fullName: string;
  avatarUrl?: string;

  messages: Message[];

  time: string;
  online: boolean;
  typing: boolean;
  newMessage: string;
  unreadCount: number;
};

export type Message = {
  _id: string;
  text: string;
  roomId: string;
  createdAt: string;
  unreadCount: number;
  attachments: string[];

  sender: Sender;
  userId: UserInfo;

  isRead: boolean;
  isDefault?: boolean;
  isDeleted: boolean;
};

export type UseMessageParams = {
  roomId?: string;
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
};
