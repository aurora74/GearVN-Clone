export type UserRole = "ADMIN" | "CUSTOMER" | null;

export type UserStatus = "VERIFIED" | "UNVERIFIED" | "BANNED";

export type User = {
  _id: string;
  fullName: string;
  email: string;
  role: UserRole;
  phone?: string;
  address?: string;
  status: UserStatus;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type UseUsersParams = {
  page: number;
  limit: number;
  search?: string;
  sortBy?: string;
  fields?: string;
};

export type CreateUserPayload = {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  address?: string;
};

export type EditUserPayload = {
  id: string;
  fullName?: string;
  email?: string;
  phone?: string;
  address?: string;
  avatar?: File;
};
