export const parseNumber = (value: string) =>
  value.replace(/\./g, "").replace(/[^0-9]/g, "");
