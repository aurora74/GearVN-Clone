import {
  fetchProductsByEvent,
  fetchProductsByCategory,
} from "@/utils/api/products";
import { fetchBlogs } from "@/utils/api/blogs";
import { fetchEvents } from "@/utils/api/events";
import { fetchCategories } from "@/utils/api/categories";

import { Blogs } from "./_components/blogs";
import { Event } from "./_components/event";
import { Banner } from "./_components/banner";
import { Sidebar } from "./_components/sidebar";
import { BestSeller } from "./_components/best-seller";
import { ProductCatalog } from "./_components/product-catalog";
import { ServiceFeatures } from "./_components/service-features";

import { AuthTokenGuard } from "@/components/guards/auth-token-guard";
import { AdImageGrid, AdImageRow } from "@/components/global/advertise-images";

const HomePage = async () => {
  const [blogs, events, categories] = await Promise.all([
    fetchBlogs(),
    fetchEvents(),
    fetchCategories(),
  ]);

  const eventProducts = await Promise.all(
    events.map((event) => fetchProductsByEvent(event.tag))
  );
  const categoryProducts = await Promise.all(
    categories.map((category) =>
      fetchProductsByCategory({ category: category.name })
    )
  );

  return (
    <AuthTokenGuard>
      <div className="bg-[#f7f8f9]">
        <ServiceFeatures />
        <div className="py-4">
          <div className="wrapper flex gap-3">
            <Sidebar categories={categories} />
            <Banner />
          </div>
          {events.map((event, idx) => (
            <Event
              event={event}
              key={event._id}
              tag={event.tag}
              events={events}
              title={event.name}
              products={eventProducts[idx]}
            />
          ))}
          <AdImageRow />
          {categories.map((category, idx) => (
            <BestSeller
              events={events}
              key={category._id}
              category={category.name}
              title={`${category.label} bán chạy`}
              products={categoryProducts[idx].data}
            />
          ))}
          <AdImageGrid />
          <ProductCatalog categories={categories} />
          <Blogs blogs={blogs.data} />
        </div>
      </div>
    </AuthTokenGuard>
  );
};

export default HomePage;
