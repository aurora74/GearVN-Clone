export const formatProductAttributes = (value: any): string => {
  if (value == null || value === "") return "-";
  if (typeof value === "object") {
    const str = JSON.stringify(value);
    return str && str !== "{}" && str !== "[]" ? str : "-";
  }
  return String(value);
};
