"use client";

import { Suspense } from "react";

import { ORDER_TABS } from "@/constants/orders/order-tabs";

import { Sidebar } from "../../_components/sidebar";
import { OrdersByStatus } from "./orders-by-status";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Breadcrumbs } from "@/components/global/breadcrumbs";

const breadcrumbs = [
  { label: "Trang chủ", href: "/" },
  { label: "Đơn hàng của tôi", href: "/settings/my-orders" },
];

export const MyOrdersPage = () => {
  return (
    <>
      <Breadcrumbs items={breadcrumbs} />

      <div className="wrapper w-full flex flex-col lg:flex-row gap-6 pt-3 pb-16">
        <Sidebar />

        <main className="flex-1 space-y-2 p-4 sm:p-6 border bg-white shadow-sm rounded-lg">
          <h1 className="text-xl font-semibold">Đơn hàng của tôi</h1>

          <Tabs defaultValue="tat-ca" className="w-full gap-4">
            <TabsList className="w-full flex justify-start overflow-x-auto">
              {ORDER_TABS.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex-1 min-w-[200px] sm:min-w-[100px]"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {ORDER_TABS.map((tab) => (
              <TabsContent key={tab.value} value={tab.value}>
                <Suspense>
                  <OrdersByStatus status={tab.status} />
                </Suspense>
              </TabsContent>
            ))}
          </Tabs>
        </main>
      </div>
    </>
  );
};
