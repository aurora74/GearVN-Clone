import { CategoryFields, CategoryType } from "@/types/category";

export const fetchCategories = async (): Promise<CategoryType[]> => {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/categories?limit=20`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return [];
    const { result } = await res.json();
    return result.data;
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
