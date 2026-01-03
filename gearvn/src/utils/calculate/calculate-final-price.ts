export const calculateFinalPrice = (price: number, discountPercent?: number) =>
  discountPercent ? price - (price * discountPercent) / 100 : price;
