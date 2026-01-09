import type { USER_ROLE } from "@/config.global";

export type UserRole =
  | typeof USER_ROLE.ADMIN
  | typeof USER_ROLE.MANAGER
  | typeof USER_ROLE.PRODUCT_MARKETING_STAFF
  | typeof USER_ROLE.SALES_OPERATIONS_STAFF
  | typeof USER_ROLE.CSR
  | typeof USER_ROLE.CUSTOMER;

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
  role?: UserRole;
  phone?: string;
  address?: string;
};

export type EditUserPayload = {
  id: string;
  fullName?: string;
  email?: string;
  role?: UserRole;
  status?: UserStatus;
  phone?: string;
  address?: string;
  avatar?: File;
};
