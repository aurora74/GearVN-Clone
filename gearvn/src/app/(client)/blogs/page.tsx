import { Metadata } from "next";

import { fetchBlogs } from "@/utils/api/blogs";

import { PageClient } from ".";
import { Breadcrumbs } from "@/components/global/breadcrumbs";

const crumbs = [
  { label: "Trang chủ", href: "/" },
  { label: "Tất cả bài viết", href: "/blogs" },
];

export const metadata: Metadata = {
  title: "Tất cả bài viết - GEARVN.COM",
  description:
    "Xem tất cả bài viết về tin tức công nghệ, review sản phẩm và hướng dẫn tại GEARVN.",
  openGraph: {
    title: "Tất cả bài viết - GEARVN.COM",
    description:
      "Xem tất cả bài viết về tin tức công nghệ, review sản phẩm và hướng dẫn tại GEARVN.",
    url: `${process.env.NEXT_PUBLIC_APP_URL}/blogs`,
  },
};

type BlogsPageProps = {
  searchParams: Promise<{ page?: string; search?: string }>;
};

const BlogsPage = async ({ searchParams }: BlogsPageProps) => {
  const params = await searchParams;

  const page = Number(params.page ?? 1);
  const search = (params.search ?? "").trim();

  const blogs = await fetchBlogs({ page, limit: 6, search });

  return (
    <div className="bg-[#f7f8f9]">
      <Breadcrumbs items={crumbs} />
      <PageClient blogs={blogs} />
    </div>
  );
};

export default BlogsPage;
