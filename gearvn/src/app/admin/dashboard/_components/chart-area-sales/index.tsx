import { useState } from "react";

import { DashboardSummary } from "@/types/dashboard";

import {
  Card,
  CardTitle,
  CardHeader,
  CardContent,
  CardDescription,
} from "@/components/ui/card";

import { DashboardAreaChart } from "./dashboard-area-chart";
import { ChartTimeRangeSelector } from "./chart-time-range-selector";

export const ChartAreaSales = ({ data }: { data: DashboardSummary }) => {
  const [timeRange, setTimeRange] = useState<string>("90");

  return (
    <Card className="pt-0">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center gap-2 space-y-0 border-b py-5">
        <div className="grid flex-1 gap-1">
          <CardTitle>Doanh thu & Số đơn hàng</CardTitle>
          <CardDescription>
            Thống kê theo khoảng thời gian đã chọn
          </CardDescription>
        </div>

        <ChartTimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </CardHeader>

      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <DashboardAreaChart
          data={data}
          timeRangeDays={timeRange ? parseInt(timeRange) : 90}
        />
      </CardContent>
    </Card>
  );
};
