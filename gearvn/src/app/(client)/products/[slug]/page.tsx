import { Metadata } from "next";
import { notFound } from "next/navigation";

import DOMPurify from "isomorphic-dompurify";

import { fetchBlogs } from "@/utils/api/blogs";
import { fetchEvents } from "@/utils/api/events";
import { fetchCategoryFieldsByName } from "@/utils/api/categories";
import { fetchProduct, fetchRelatedProducts } from "@/utils/api/products";

import { Blogs } from "./_components/blogs";
import { ProductInfo } from "./_components/product-info";
import { ProductImage } from "./_components/product-image";
import { ProductReview } from "./_components/product-review";
import { RelatedProducts } from "./_components/related-products";
import { ProductConfiguration } from "./_components/product-configuration";

import { Breadcrumbs } from "@/components/global/breadcrumbs";
import { SectionHeader } from "@/components/global/section-header";

const baseCrumbs = [
  { label: "Trang chủ", href: "/" },
  { label: "Danh mục", href: "/collections" },
];

type ProductDetailsPageProps = {
  params: Promise<{ slug: string }>;
};

export const generateMetadata = async ({
  params,
}: ProductDetailsPageProps): Promise<Metadata> => {
  const { slug } = await params;
  const product = await fetchProduct(slug);

  if (!product) {
    return {
      title: "Sản phẩm không tồn tại | GEARVN.COM",
      description: "Sản phẩm bạn tìm kiếm không tồn tại hoặc đã bị xóa.",
    };
  }

  return {
    title: `${product.name} | GEARVN.COM`,
    description: product.description || "Thông tin chi tiết sản phẩm",
    openGraph: {
      title: product.name,
      description: product.description || "Thông tin chi tiết sản phẩm",
      images: product.images?.length ? [product.images[0]] : [],
    },
  };
};

const ProductDetailsPage = async ({ params }: ProductDetailsPageProps) => {
  const { slug } = await params;
  const product = await fetchProduct(slug);

  const [blogs, events, relatedProducts, fields] = await Promise.all([
    fetchBlogs(),
    fetchEvents(),
    product && fetchRelatedProducts(product._id),
    product && fetchCategoryFieldsByName(product.category),
  ]);

  if (!product) return notFound();

  const breadcrumbs = [...baseCrumbs, { label: product.name }];

  return (
    <>
      <Breadcrumbs items={breadcrumbs} />

      <div className="py-4 bg-[#f7f8f9]">
        <div className="wrapper space-y-6">
          <div className="flex flex-col lg:flex-row gap-12 p-4 sm:p-8 bg-white shadow-sm rounded-sm">
            <ProductImage images={product.images} />
            <ProductInfo
              events={events}
              product={product}
              relatedProducts={relatedProducts}
            />
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            <div className="w-full lg:w-[60%] space-y-6">
              <div className="p-4 sm:p-6 space-y-4 bg-white shadow-sm rounded-sm">
                <h2 className="text-xl font-bold">Cấu hình</h2>
                {fields && (
                  <ProductConfiguration product={product} fields={fields} />
                )}
              </div>

              <div className="p-4 sm:p-6 bg-white shadow-sm rounded-sm">
                <h2 className="text-xl font-bold">Thông tin sản phẩm</h2>
                {product.description ? (
                  <div
                    className="description"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(product.description, {
                        USE_PROFILES: { html: true },
                        ADD_TAGS: [],
                        ADD_ATTR: [],
                      }),
                    }}
                  />
                ) : (
                  <p className="text-gray-500 italic">
                    Chưa có mô tả cho sản phẩm này.
                  </p>
                )}
              </div>

              <ProductReview productId={product._id} />
            </div>

            <div className="w-full lg:w-[40%]">
              <div className="lg:sticky top-20 lg:px-2 lg:-mx-2">
                <div className="p-4 sm:p-6 space-y-4 bg-white shadow-sm rounded-sm">
                  <h2 className="text-xl font-bold">Tin tức về công nghệ</h2>
                  <Blogs blogs={blogs.data} />
                </div>
              </div>
            </div>
          </div>

          <div className="my-8">
            <div className="pt-6 pb-8 px-3 sm:pb-10 sm:px-6 space-y-8 bg-white shadow-sm rounded-sm">
              <SectionHeader
                href="/collections"
                linkLabel="Xem tất cả"
                title="Sản phẩm tương tự"
                srLabel="Xem tất cả sản phẩm"
              />
              <RelatedProducts events={events} products={relatedProducts} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProductDetailsPage;
