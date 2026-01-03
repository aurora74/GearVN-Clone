export const formatNumber = (value?: number) =>
  value !== undefined && value !== null
    ? value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")
    : "";
