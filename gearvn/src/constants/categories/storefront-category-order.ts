export const STOREFRONT_CATEGORY_ORDER = [
  "test",
  "monitor",
  "chair",
  "laptop",
  "pc",
  "cooler",
  "ram",
  "mouse",
  "headphone",
  "mainboard",
  "powerbank",
  "accessory",
  "speaker",
  "case",
  "psu",
  "keyboard",
  "storage",
] as const;

export const STOREFRONT_CATEGORY_ORDER_INDEX = new Map<string, number>(
  STOREFRONT_CATEGORY_ORDER.map((name, index) => [name, index])
);
