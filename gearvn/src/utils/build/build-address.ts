import {
  WardType,
  DistrictType,
  ProvinceType,
  AddressFormData,
} from "@/types/order";

export const buildAddress = (
  wards: WardType[],
  provinces: ProvinceType[],
  districts: DistrictType[],
  data: AddressFormData
): string => {
  return [
    data.street,
    wards.find((w) => String(w.code) === data.ward)?.name,
    districts.find((d) => String(d.code) === data.district)?.name,
    provinces.find((p) => String(p.code) === data.province)?.name,
  ]
    .filter(Boolean)
    .join(", ");
};
