export const calculateDiscountedPrice = (
  price: number,
  discountPercent?: number
) => {
  const discount = discountPercent ?? 0;
  const finalPrice = discount > 0 ? price - (price * discount) / 100 : price;
  return { finalPrice, hasDiscount: discount > 0 };
};
