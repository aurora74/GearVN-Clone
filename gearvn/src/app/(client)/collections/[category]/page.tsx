import { Metadata } from "next";
import { notFound } from "next/navigation";

import { parseFilters } from "@/utils/filters";
import { fetchEvents } from "@/utils/api/events";
import { fetchCategoryLabel } from "@/utils/api/categories";
import { fetchProductsByCategory } from "@/utils/api/products";

import { ListProducts } from "./_components/list-products";
import { FilterProducts } from "./_components/filter-products";

import { Breadcrumbs } from "@/components/global/breadcrumbs";
import { AutoBanner } from "@/components/global/advertise-images";

const baseCrumbs = [
  { label: "Trang chủ", href: "/" },
  { label: "Danh mục", href: "/collections" },
];

type CollectionsPageProps = {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
};

export const generateMetadata = async ({
  params,
}: CollectionsPageProps): Promise<Metadata> => {
  const { category } = await params;
  const { label } = await fetchCategoryLabel(category);

  if (!label) {
    return {
      title: "Danh mục không tồn tại | GEARVN.COM",
      description: "Danh mục bạn tìm không tồn tại hoặc đã bị xóa.",
    };
  }

  return {
    title: `${label} - Danh mục sản phẩm | GEARVN.COM`,
    description: `Khám phá các sản phẩm thuộc danh mục ${label} tại GearVN.`,
    openGraph: {
      title: `${label} - Danh mục sản phẩm | GEARVN.COM`,
      description: `Khám phá các sản phẩm thuộc danh mục ${label} tại GearVN.`,
    },
  };
};

const CollectionsPage = async ({
  params,
  searchParams,
}: CollectionsPageProps) => {
  const { category } = await params;
  const { attributes, search, page: pageParam } = (await searchParams) || {};

  const page = pageParam ? parseInt(pageParam) : 1;
  const filters = attributes ? parseFilters(attributes) : undefined;

  const [events, products, { label }] = await Promise.all([
    fetchEvents(),
    fetchProductsByCategory({
      page,
      category: category,
      search: search || undefined,
      filters: filters || undefined,
    }),
    fetchCategoryLabel(category),
  ]);

  if (!label) return notFound();

  const breadcrumbs = [...baseCrumbs, { label }];

  return (
    <>
      <Breadcrumbs items={breadcrumbs} />
      <div className="bg-[#f7f8f9] pt-4 pb-16">
        <div className="wrapper space-y-3">
          <AutoBanner />
          <div className="space-y-6 rounded-sm py-8 px-2 lg:py-6 lg:px-8 bg-white shadow-sm">
            <FilterProducts category={category} />
            <ListProducts
              page={page}
              events={events}
              products={products}
              category={category}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default CollectionsPage;
