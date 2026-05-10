import { CategoryFieldsType } from "@/types/category";

export const buildCollectionUrl = (
  category: string,
  fieldName?: string,
  fieldType?: CategoryFieldsType,
  option?: string | number,
) => {
  const params = new URLSearchParams();
  if (fieldName && option !== undefined && option !== null) {
    params.set(fieldName, String(option));
    if (fieldType) params.set(`${fieldName}Type`, fieldType);
  }

  const query = params.toString();
  return `/collections/${encodeURIComponent(category)}${query ? `?${query}` : ""}`;
};
