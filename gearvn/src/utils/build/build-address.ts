import { AddressItem } from "@/hooks/use-vietnam-address";

type AddressForm = {
  street?: string;
  ward?: string;
  district?: string;
  province?: string;
};

export const buildAddress = (
  wards: AddressItem[] | undefined,
  provinces: AddressItem[] | undefined,
  districts: AddressItem[] | undefined,
  data: AddressForm,
) => {
  const parts = [
    data.street,
    findAddressName(wards, data.ward),
    findAddressName(districts, data.district),
    findAddressName(provinces, data.province),
  ];

  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(", ");
};

const findAddressName = (
  items: AddressItem[] | undefined,
  code?: string,
): string | undefined => {
  if (!code) return undefined;
  const item = items?.find((entry) => String(entry.code) === String(code));
  return item?.name ?? code;
};
