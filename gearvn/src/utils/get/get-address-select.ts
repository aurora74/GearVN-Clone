import { AddressSelectConfig } from "@/types/global";
import { AddressItem } from "@/hooks/use-vietnam-address";

export const getAddressSelect = (
  wards: AddressItem[] | undefined,
  provinces: AddressItem[] | undefined,
  districts: AddressItem[] | undefined,
  wardsPending: boolean,
  provincesPending: boolean,
  districtsPending: boolean,
  provinceCode?: string,
  districtCode?: string
): AddressSelectConfig[] => [
  {
    name: "province",
    label: "Tỉnh / Thành phố",
    options: provinces,
    loading: provincesPending,
    disabled: false,
  },
  {
    name: "district",
    label: "Quận / Huyện",
    options: districts,
    loading: districtsPending,
    disabled: !provinceCode,
  },
  {
    name: "ward",
    label: "Phường / Xã",
    options: wards,
    loading: wardsPending,
    disabled: !districtCode,
  },
];
