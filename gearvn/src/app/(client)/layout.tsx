import { fetchCategories } from "@/utils/api/categories";

import { TopAdvertise } from "./(home)/_components/top-advertise";

import { Footer } from "@/components/global/home/footer";
import { Header } from "@/components/global/home/header/header";
import { NavMobile } from "@/components/global/home/header/nav-mobile";
import { ConditionalChatMessage } from "@/components/global/chat-message/conditional-chat-message";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const categories = await fetchCategories();

  return (
    <>
      <TopAdvertise />
      <Header categories={categories} />
      <NavMobile />
      <ConditionalChatMessage />
      <main>{children}</main>
      <Footer />
    </>
  );
}
