export type AuthModalType =
  | "login"
  | "register"
  | "reset-password"
  | "verify-account"
  | "forgot-password"
  | null;

export type RoleType = "ADMIN" | "CUSTOMER";

export type AccountStatusType = "VERIFIED" | "UNVERIFIED" | "BANNED";

export type TokenPayload = {
  role: RoleType;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  email: string;
  fullName: string;
  password: string;
};

export type ResetPasswordPayload = {
  token: string;
  newPassword: string;
};

export type ForgotPasswordPayload = {
  email: string;
};

export type SuccessResponseParams = {
  message?: string;
  description?: string;
  status?: number;
  result?: any;
};

export type ErrorResponseParams = {
  message?: string;
  description?: string;
  status?: number;
  detail?: any;
};
