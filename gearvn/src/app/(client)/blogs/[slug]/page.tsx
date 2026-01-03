import { Metadata } from "next";
import { notFound } from "next/navigation";

import { fetchBlog, fetchRelatedBlogs } from "@/utils/api/blogs";

import { MainContent } from "./_components/main-content";
import { RelatedBlogs } from "./_components/related-blogs";

import { Breadcrumbs } from "@/components/global/breadcrumbs";
import { AdImageGrid, AutoBanner } from "@/components/global/advertise-images";

const baseCrumbs = [
  { label: "Trang chủ", href: "/" },
  { label: "Tin tức công nghệ", href: "/blogs" },
];

type BlogDetailsPageProps = {
  params: Promise<{ slug: string }>;
};

export const generateMetadata = async ({
  params,
}: BlogDetailsPageProps): Promise<Metadata> => {
  const { slug } = await params;
  const blog = await fetchBlog(slug);

  if (!blog) {
    return {
      title: "Bài viết không tồn tại | GEARVN.COM",
      description: "Trang bạn đang tìm không tồn tại",
    };
  }

  const { title, description, thumbnail } = blog;

  return {
    title: `${title} | GEARVN.COM`,
    description: description,
    openGraph: {
      title,
      description: description,
      images: thumbnail ? [thumbnail] : [],
    },
  };
};

export default async function BlogDetailsPage({
  params,
}: BlogDetailsPageProps) {
  const { slug } = await params;

  const [blog, relatedBlogs] = await Promise.all([
    fetchBlog(slug),
    fetchBlog(slug).then((blog) => (blog ? fetchRelatedBlogs(blog._id) : [])),
  ]);

  if (!blog) return notFound();

  const breadcrumbs = [...baseCrumbs, { label: blog.title }];

  return (
    <>
      <Breadcrumbs items={breadcrumbs} />
      <div className="bg-[#f7f8f9] py-4">
        <div className="wrapper space-y-3">
          <AutoBanner />
          <MainContent blog={blog} />
        </div>
        <AdImageGrid />
        <RelatedBlogs blogs={relatedBlogs} />
      </div>
    </>
  );
}
