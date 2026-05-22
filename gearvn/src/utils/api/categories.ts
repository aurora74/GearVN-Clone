import { STOREFRONT_CATEGORY_ORDER_INDEX } from "@/constants/categories/storefront-category-order";
import { CategoryFields, CategoryType } from "@/types/category";

export const fetchCategories = async (): Promise<CategoryType[]> => {
  try {
    const params = new URLSearchParams({
      limit: "100",
      fields: "name,label,image,fields,createdAt,updatedAt,sourceMetadata",
    });
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/categories?${params.toString()}`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return [];
    const { result } = await res.json();
    const categories = Array.isArray(result?.data) ? result.data : [];

    return categories
      .filter(
        (category: CategoryType) =>
          category.sourceMetadata?.source !== "product-corpus-import"
      )
      .sort((a: CategoryType, b: CategoryType) => {
        const aOrder = STOREFRONT_CATEGORY_ORDER_INDEX.get(a.name);
        const bOrder = STOREFRONT_CATEGORY_ORDER_INDEX.get(b.name);

        if (aOrder !== undefined && bOrder !== undefined) {
          return aOrder - bOrder;
        }

        if (aOrder !== undefined) return 1;
        if (bOrder !== undefined) return -1;

        const createdAtDiff =
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

        if (createdAtDiff !== 0) return createdAtDiff;

        return a.name.localeCompare(b.name);
      });
  } catch {
    return [];
  }
};

export const fetchCategoryFieldsByName = async (
  name: string
): Promise<CategoryFields[] | null> => {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/categories/fields/${name}`,
      { next: { revalidate: 60 } }
    );

    if (!res.ok) return [];

    const { result } = await res.json();
    return result;
  } catch {
    return [];
  }
};

export const fetchCategoryLabel = async (
  category: string
): Promise<{ label: string | null }> => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/categories/label/${category}`,
      { next: { revalidate: 60 } }
    );
    if (!response.ok) return { label: null };
    const { result } = await response.json();
    return { label: result.label };
  } catch {
    return { label: null };
  }
};
