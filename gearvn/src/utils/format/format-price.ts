export const formatPrice = (
  price: number | undefined | null,
  locale = "vi-VN",
  currency = "₫"
) => {
  if (price == null) return "";
  return `${price.toLocaleString(locale)}${currency}`;
};
