export const USER_ROLE = {
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  PRODUCT_MARKETING_STAFF: "PRODUCT_MARKETING_STAFF",
  SALES_OPERATIONS_STAFF: "SALES_OPERATIONS_STAFF",
  CSR: "CSR",
  CUSTOMER: "CUSTOMER",
} as const;

export const USER_ROLES = Object.values(USER_ROLE);

export const BUSINESS_ROLES = [
  USER_ROLE.MANAGER,
  USER_ROLE.PRODUCT_MARKETING_STAFF,
  USER_ROLE.SALES_OPERATIONS_STAFF,
  USER_ROLE.CSR,
] as const;

export const ADMIN_GOVERNANCE_ROLES = [USER_ROLE.ADMIN] as const;

export const ROLE_LANDING_ROUTE = {
  [USER_ROLE.ADMIN]: "/admin/system",
  [USER_ROLE.MANAGER]: "/admin/dashboard",
  [USER_ROLE.PRODUCT_MARKETING_STAFF]: "/admin/products",
  [USER_ROLE.SALES_OPERATIONS_STAFF]: "/admin/orders",
  [USER_ROLE.CSR]: "/admin/chat",
  [USER_ROLE.CUSTOMER]: "/",
} as const;

export const MODAL = {
  LOGIN: "login",
  REGISTER: "register",
  "FORGOT-PASSWORD": "forgot-password",
  "RESET-PASSWORD": "reset-password",
  "VERIFY-ACCOUNT": "verify-account",
};

export const ORDER_STATUS = {
  PROCESSING: "PROCESSING",
  SHIPPING: "SHIPPING",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
};

export const PAYMENT_STATUS = {
  PENDING: "PENDING",
  PAID: "PAID",
  CANCELLED: "CANCELLED",
};

export const ACCOUNT_STATUS = {
  VERIFIED: "VERIFIED",
  UNVERIFIED: "UNVERIFIED",
  BANNED: "BANNED",
};

export const PAYMENT_METHOD = {
  COD: "COD",
  VNPAY: "VNPAY",
};

export const SUPPORT_TICKET_STATUS = {
  NEW: "new",
  PROCESSING: "processing",
  RESOLVED: "resolved",
} as const;

export const SUPPORT_TICKET_SOURCE = {
  PRODUCT_QNA: "product_qna",
  CHAT: "chat",
} as const;
