export const calculateDiscountedPrice = (
  price: number,
  discountPercent?: number
) => {
  const discount = discountPercent ?? 0;
  const finalPrice = price - discount;
  return { finalPrice, hasDiscount: discount > 0 };
};
