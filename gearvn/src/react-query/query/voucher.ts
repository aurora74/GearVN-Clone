import { useMutation, useQuery } from "@tanstack/react-query";

import { queryKeys } from "../query-keys";

import { PaginatedResponse } from "@/types/global";
import {
  PublicVoucherParams,
  UseVouchersParams,
  ValidateVoucherPayload,
  VoucherType,
  VoucherValidationResult,
} from "@/types/voucher";

const toQueryString = (params: Record<string, unknown>) => {
  const queryParams = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => [key, String(value)]);

  return new URLSearchParams(queryParams);
};

export const useVouchers = (
  params: UseVouchersParams = { page: 1, limit: 20 }
) =>
  useQuery<PaginatedResponse<VoucherType>>({
    queryKey: queryKeys.voucher.list(params),
    queryFn: async () => {
      const query = toQueryString(params);
      const response = await fetch(`/api/vouchers?${query}`, {
        credentials: "include",
      });
      const { result } = await response.json();
      return result;
    },
  });

export const usePublicVouchers = (params: PublicVoucherParams = {}) =>
  useQuery<VoucherType[]>({
    queryKey: queryKeys.voucher.public(params),
    queryFn: async () => {
      const query = toQueryString(params);
      const response = await fetch(`/api/vouchers/public?${query}`, {
        credentials: "include",
      });
      const { result } = await response.json();
      return result;
    },
  });

export const useVoucher = (voucherId: string) =>
  useQuery<VoucherType>({
    queryKey: queryKeys.voucher.detail(voucherId),
    queryFn: async () => {
      const response = await fetch(`/api/vouchers/${voucherId}`, {
        credentials: "include",
      });
      const { result } = await response.json();
      return result;
    },
    enabled: !!voucherId,
  });

export const useValidateVoucher = () =>
  useMutation({
    mutationFn: async (payload: ValidateVoucherPayload) => {
      const response = await fetch("/api/vouchers/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw data;
      return data.result as VoucherValidationResult;
    },
  });
