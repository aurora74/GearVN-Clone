import { VOUCHER_DISCOUNT_TYPE } from "@/config.global";

export type VoucherDiscountType =
  (typeof VOUCHER_DISCOUNT_TYPE)[keyof typeof VOUCHER_DISCOUNT_TYPE];

export type VoucherStatus =
  | "scheduled"
  | "active"
  | "expired"
  | "exhausted"
  | "disabled";

export type VoucherFailureCode =
  | "VOUCHER_INVALID"
  | "VOUCHER_NOT_ACTIVE"
  | "VOUCHER_EXPIRED"
  | "VOUCHER_USAGE_LIMIT"
  | "VOUCHER_MINIMUM_NOT_MET";

export type VoucherType = {
  _id?: string;
  code: string;
  discountType: VoucherDiscountType;
  discountValue: number;
  minimumOrderValue: number;
  maximumDiscountAmount?: number;
  startsAt: string;
  endsAt: string;
  usageLimit?: number;
  usedCount?: number;
  isEnabled?: boolean;
  disabledAt?: string;
  status?: VoucherStatus;
  createdAt?: string;
  updatedAt?: string;
};

export type UseVouchersParams = {
  page?: number;
  limit?: number;
  search?: string;
};

export type PublicVoucherParams = {
  subtotal?: number;
};

export type CreateVoucherPayload = {
  code: string;
  discountType: VoucherDiscountType;
  discountValue: number;
  minimumOrderValue: number;
  maximumDiscountAmount?: number;
  startsAt: string;
  endsAt: string;
  usageLimit: number;
  isEnabled?: boolean;
  reason?: string;
};

export type UpdateVoucherPayload = Partial<CreateVoucherPayload> & {
  id: string;
};

export type ValidateVoucherPayload = {
  code: string;
  subtotal: number;
};

export type VoucherValidationResult = VoucherType & {
  discountAmount: number;
};

export type VoucherErrorDetail = {
  code: VoucherFailureCode;
};
