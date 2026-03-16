type PromotionProduct = {
  stock?: number;
  isPublished?: boolean;
  published?: boolean;
  isActive?: boolean;
  available?: boolean;
  isAvailable?: boolean;
  status?: string;
};

const INELIGIBLE_STATUSES = new Set([
  'unpublished',
  'inactive',
  'unavailable',
  'hidden',
  'archived',
  'deleted',
]);

export const isPromotionEligibleProduct = (
  product: PromotionProduct,
): boolean => {
  if ((product.stock ?? 0) <= 0) {
    return false;
  }

  const booleanVisibilityFields: Array<keyof PromotionProduct> = [
    'isPublished',
    'published',
    'isActive',
    'available',
    'isAvailable',
  ];

  for (const field of booleanVisibilityFields) {
    if (product[field] === false) {
      return false;
    }
  }

  if (
    typeof product.status === 'string' &&
    INELIGIBLE_STATUSES.has(product.status.toLowerCase())
  ) {
    return false;
  }

  return true;
};
