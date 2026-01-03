"use client";

import { Inbox } from "lucide-react";

import { useDashboardSummary } from "@/react-query/query/dashboard";

import { SectionCards } from "./section-cards";
import { ChartAreaSales } from "./chart-area-sales";
import { DashboardSkeleton } from "./dashboard-skeleton";

export const DashboardPage = () => {
  const { data, isPending } = useDashboardSummary();

  return (
    <div className="h-full p-4 space-y-4 border bg-white shadow-sm rounded-md">
      {isPending ? (
        <DashboardSkeleton />
      ) : data ? (
        <>
          <SectionCards data={data} />
          <ChartAreaSales data={data} />
        </>
      ) : (
        <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
          <Inbox strokeWidth={1.5} className="size-10 text-muted-foreground" />
          <span>Không có dữ liệu thống kê</span>
        </div>
      )}
    </div>
  );
};
