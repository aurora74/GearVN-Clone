"use client";

import { CategoryType } from "@/types/category";

import { CategoryCard } from "./category-card";

export const ProductCatalog = ({
  categories,
}: {
  categories: CategoryType[];
}) => {
  const isEmpty = categories.length === 0;

  return (
    <section className="wrapper" aria-labelledby="product-catalog-heading">
      <div className="pt-6 pb-8 px-3 sm:pb-10 sm:px-6 space-y-8 bg-white shadow-sm rounded-sm">
        <h2
          id="product-catalog-heading"
          className="text-xl sm:text-2xl font-bold"
        >
          Danh mục sản phẩm
        </h2>

        {isEmpty ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Hiện chưa có danh mục nào.
          </p>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 sm:gap-6">
            {categories.map((category) => (
              <CategoryCard key={category._id} category={category} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
