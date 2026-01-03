export const buildCollectionUrl = (
  categoryName: string,
  fieldName: string,
  fieldType: string,
  option: string | number
) => {
  const value = fieldType === "number" ? Number(option) : option;

  const encodedValue = encodeURIComponent(String(value));

  return `/collections/${categoryName}?attributes=${fieldName}=${encodedValue}`;
};
