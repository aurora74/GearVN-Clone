import { DashboardSummary } from "@/types/dashboard";

import { formatPrice } from "@/utils/format/format-price";
import { formatPercent } from "@/utils/format/format-percent";

import { StatCard } from "./stat-card";
import { TopProductCard } from "./top-product-card";

export const SectionCards = ({ data }: { data: DashboardSummary }) => {
  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Tổng doanh thu"
        value={formatPrice(data.totalRevenue)}
        trend={data.revenueGrowth >= 0 ? "up" : "down"}
        trendValue={
          (data.revenueGrowth >= 0 ? "+" : "") +
          formatPercent(data.revenueGrowth)
        }
        trendDescription="Tăng trưởng so với tháng trước"
        footerDescription="Doanh thu từ tất cả kênh bán hàng"
      />

      <StatCard
        title="Số đơn hàng"
        value={data.ordersCount.toString()}
        footerDescription="Tăng so với kỳ trước"
        trendDescription="Số đơn hàng hoàn thành"
        trend={data.ordersGrowth >= 0 ? "up" : "down"}
        trendValue={
          (data.ordersGrowth >= 0 ? "+" : "") + formatPercent(data.ordersGrowth)
        }
      />

      <StatCard
        title="Khách hàng mới"
        value={data.newCustomers.toString()}
        trendDescription="Thay đổi khách hàng mới"
        trendValue={
          (data.newCustomersDecline >= 0 ? "+" : "") +
          formatPercent(data.newCustomersDecline)
        }
        trend={data.newCustomersDecline >= 0 ? "up" : "down"}
        footerDescription="Cần cải thiện chiến lược marketing"
      />

      {data.topProduct ? (
        <TopProductCard
          product={data.topProduct}
          footerDescription="Cần bổ sung số lượng"
          trendDescription={`Số lượng bán: ${data.topProduct.soldQuantity}`}
        />
      ) : (
        <StatCard
          trendDescription=""
          footerDescription=""
          value="Chưa có dữ liệu"
          title="Sản phẩm bán chạy"
        />
      )}
    </div>
  );
};
