"use client";

import { useState } from "react";
import { Inbox, RefreshCw } from "lucide-react";

import { DashboardSummary, DashboardSummaryParams } from "@/types/dashboard";
import { Button } from "@/components/ui/button";
import { useDashboardSummary } from "@/react-query/query/dashboard";

import { SectionCards } from "./section-cards";
import { ChartAreaSales } from "./chart-area-sales";
import { DashboardSkeleton } from "./dashboard-skeleton";
import { DashboardFilterBar } from "./dashboard-filter-bar";
import { ProductStockHealth } from "./product-stock-health";
import { PromotionAnalytics } from "./promotion-analytics";

const hasDashboardMetrics = (data?: DashboardSummary) => {
  if (!data) return false;

  const pipelineTotal = Object.values(data.pipeline).reduce(
    (sum, value) => sum + value,
    0
  );

  return Boolean(
    data.kpis.totalRevenue > 0 ||
      data.kpis.ordersCount > 0 ||
      data.kpis.newCustomers > 0 ||
      data.kpis.totalCustomers > 0 ||
      data.kpis.totalProducts > 0 ||
      data.kpis.activeProducts > 0 ||
      pipelineTotal > 0 ||
      data.salesOrdersTrend.some((item) => item.sales > 0 || item.orders > 0) ||
      data.productPerformance.topSellers.length > 0 ||
      data.stockAlerts.lowStockProducts.length > 0 ||
      data.stockAlerts.outOfStockProducts.length > 0 ||
      data.stockAlerts.unpublishedLowStockCount > 0 ||
      data.promotionAnalytics.topCampaigns.length > 0 ||
      data.promotionAnalytics.summary.flashSaleOrdersCount > 0 ||
      data.promotionAnalytics.summary.totalVoucherUses > 0 ||
      data.promotionAnalytics.summary.totalVoucherDiscountAmount > 0
  );
};

export const DashboardPage = () => {
  const [filters, setFilters] = useState<DashboardSummaryParams>({
    preset: "30d",
  });
  const { data, isError, isPending, refetch } = useDashboardSummary(filters);
  const hasMetrics = hasDashboardMetrics(data);

  return (
    <div className="h-full p-4 space-y-4 border bg-white shadow-sm rounded-md">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">
            Thống kê kinh doanh
          </h1>
          <p className="text-sm text-muted-foreground">
            Doanh thu hoàn thành, đơn hàng, khách hàng và tồn kho theo kỳ.
          </p>
        </div>
      </div>

      <DashboardFilterBar value={filters} onChange={setFilters} />

      {isPending ? (
        <DashboardSkeleton />
      ) : isError ? (
        <div className="min-h-[360px] flex flex-col items-center justify-center gap-3 text-center text-muted-foreground">
          <Inbox strokeWidth={1.5} className="size-10 text-destructive" />
          <div className="space-y-1">
            <div className="font-medium text-foreground">
              Không tải được thống kê. Vui lòng thử lại.
            </div>
          </div>
          <Button type="button" onClick={() => refetch()}>
            <RefreshCw className="size-4" />
            Thử lại
          </Button>
        </div>
      ) : data && hasMetrics ? (
        <>
          <SectionCards data={data} />
          <ChartAreaSales data={data} />
          <ProductStockHealth data={data} />
          <PromotionAnalytics data={data} />
        </>
      ) : (
        <div className="min-h-[360px] flex flex-col items-center justify-center text-muted-foreground gap-2 text-center">
          <Inbox strokeWidth={1.5} className="size-10 text-muted-foreground" />
          <div className="space-y-1">
            <div className="font-medium text-foreground">
              Chưa có dữ liệu thống kê
            </div>
            <div className="text-sm">
              Hãy chọn khoảng thời gian khác hoặc kiểm tra lại dữ liệu đơn hàng.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
