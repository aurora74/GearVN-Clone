export const parseFilters = (raw: string | null): Record<string, string[]> => {
  if (!raw) return {};
  return raw.split(";").reduce<Record<string, string[]>>((acc, entry) => {
    const [k, v] = entry.split("=");
    if (k && v) acc[k] = v.split(",");
    return acc;
  }, {});
};

export const serializeFilters = (
  filters: Record<string, string[]> | null
): string => {
  if (!filters || Object.keys(filters).length === 0) return "";
  return Object.entries(filters)
    .map(([k, v]) => `${k}=${v.join(",")}`)
    .join(";");
};
