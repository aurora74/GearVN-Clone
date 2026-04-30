import { AreaChart, Area, CartesianGrid, XAxis, YAxis } from "recharts";

import { DashboardSummary } from "@/types/dashboard";

import {
  ChartLegend,
  ChartConfig,
  ChartTooltip,
  ChartContainer,
  ChartLegendContent,
  ChartTooltipContent,
} from "@/components/ui/chart";

const chartConfig: ChartConfig = {
  sales: { label: "Doanh thu (VND)", color: "var(--chart-1)" },
  orders: { label: "Số đơn hàng", color: "var(--chart-2)" },
};

type DashboardAreaChartProps = {
  data: DashboardSummary;
};

export const DashboardAreaChart = ({ data }: DashboardAreaChartProps) => {
  const chartData = data.salesOrdersTrend ?? [];

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("vi-VN", {
      month: "short",
      day: "numeric",
    });

  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-auto h-[250px] w-full"
    >
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="fillSales" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopOpacity={0.8}
              stopColor="var(--color-sales)"
            />
            <stop
              offset="95%"
              stopOpacity={0.1}
              stopColor="var(--color-sales)"
            />
          </linearGradient>
          <linearGradient id="fillOrders" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopOpacity={0.8}
              stopColor="var(--color-orders)"
            />
            <stop
              offset="95%"
              stopOpacity={0.1}
              stopColor="var(--color-orders)"
            />
          </linearGradient>
        </defs>

        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickMargin={8}
          minTickGap={32}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatDate}
        />
        <YAxis yAxisId="sales" hide />
        <YAxis yAxisId="orders" hide orientation="right" />

        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent labelFormatter={formatDate} indicator="dot" />
          }
        />

        <Area
          yAxisId="orders"
          type="natural"
          dataKey="orders"
          fill="url(#fillOrders)"
          stroke="var(--color-orders)"
        />
        <Area
          yAxisId="sales"
          type="natural"
          dataKey="sales"
          fill="url(#fillSales)"
          stroke="var(--color-sales)"
        />

        <ChartLegend content={<ChartLegendContent />} />
      </AreaChart>
    </ChartContainer>
  );
};
