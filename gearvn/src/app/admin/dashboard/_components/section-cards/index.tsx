import { DashboardSummary } from "@/types/dashboard";

import { formatPrice } from "@/utils/format/format-price";
import { formatPercent } from "@/utils/format/format-percent";

import { StatCard } from "./stat-card";

const formatTrend = (value: number) =>
  `${value >= 0 ? "+" : ""}${formatPercent(value)}`;

const formatPaymentBreakdown = (data: DashboardSummary) => {
  const byMethod = new Map(
    data.paymentBreakdown.map((item) => [item.paymentMethod, item.revenue])
  );

  return `COD ${formatPrice(byMethod.get("COD") ?? 0)} · VNPay ${formatPrice(
    byMethod.get("VNPAY") ?? 0
  )}`;
};

export const SectionCards = ({ data }: { data: DashboardSummary }) => {
  const stockAlertCount =
    data.stockAlerts.lowStockProducts.length +
    data.stockAlerts.outOfStockProducts.length;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Doanh thu hoàn thành"
        value={formatPrice(data.kpis.totalRevenue)}
        trend={data.comparison.revenueGrowth >= 0 ? "up" : "down"}
        trendValue={formatTrend(data.comparison.revenueGrowth)}
        trendDescription="So với kỳ trước"
        footerDescription="Chỉ tính đơn hàng đã hoàn thành"
        secondaryDetail={formatPaymentBreakdown(data)}
      />

      <StatCard
        title="Số đơn hàng"
        value={data.kpis.ordersCount.toLocaleString("vi-VN")}
        footerDescription={`Đơn đang xử lý: ${data.pipeline.processing}`}
        trendDescription="Đơn hoàn thành trong kỳ"
        trend={data.comparison.ordersGrowth >= 0 ? "up" : "down"}
        trendValue={formatTrend(data.comparison.ordersGrowth)}
        secondaryDetail={`Đang giao: ${data.pipeline.shipping} · Chờ thanh toán: ${data.pipeline.paymentPending}`}
      />

      <StatCard
        title="Khách hàng"
        value={data.kpis.totalCustomers.toLocaleString("vi-VN")}
        trendDescription="Khách mới trong kỳ"
        trendValue={formatTrend(data.comparison.customerGrowth)}
        trend={data.comparison.customerGrowth >= 0 ? "up" : "down"}
        footerDescription={`${data.kpis.newCustomers.toLocaleString("vi-VN")} khách mới`}
      />

      <StatCard
        title="Cảnh báo sản phẩm"
        value={stockAlertCount.toLocaleString("vi-VN")}
        trendDescription="Tồn kho cần xử lý"
        footerDescription={`${data.kpis.activeProducts.toLocaleString("vi-VN")} sản phẩm đang bán`}
        secondaryDetail={`Hết hàng: ${data.stockAlerts.outOfStockProducts.length} · Sắp hết: ${data.stockAlerts.lowStockProducts.length}`}
      />
    </div>
  );
};
