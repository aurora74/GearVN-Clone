import { useQuery } from "@tanstack/react-query";

export type AddressItem = { code: number; name: string };

export const useProvinces = () =>
  useQuery<AddressItem[]>({
    queryKey: ["provinces"],

    queryFn: async () => {
      const response = await fetch("/api/vietnam/provinces");

      const { result } = await response.json();
      return result;
    },
  });

export const useDistricts = (provinceCode?: string) =>
  useQuery<AddressItem[]>({
    queryKey: ["districts", provinceCode],

    queryFn: async () => {
      if (!provinceCode) return [];
      const response = await fetch(
        `/api/vietnam/districts?provinceCode=${provinceCode}`
      );

      const { result } = await response.json();
      return result;
    },

    enabled: !!provinceCode,
  });

export const useWards = (districtCode?: string) =>
  useQuery<AddressItem[]>({
    queryKey: ["wards", districtCode],

    queryFn: async () => {
      if (!districtCode) return [];
      const response = await fetch(
        `/api/vietnam/wards?districtCode=${districtCode}`
      );

      const { result } = await response.json();
      return result;
    },

    enabled: !!districtCode,
  });
