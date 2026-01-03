import { ComponentType } from "react";

import { AddressItem } from "@/hooks/use-vietnam-address";

export type ApiListResponse<T> = {
  message: string;
  description: string;
  result: PaginatedResponse<T>;
};

export type PaginatedResponse<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ServiceFeatureType = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  href: string;
};

export type DropdownPositionType = {
  top: number;
  left: number;
  maxHeight: number;
};

export type AddressSelectConfig = {
  label: string;
  loading: boolean;
  disabled: boolean;
  options?: AddressItem[];
  name: "province" | "district" | "ward";
};
