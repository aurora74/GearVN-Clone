import { DashboardSummary } from "@/types/dashboard";

import {
  Card,
  CardTitle,
  CardHeader,
  CardContent,
  CardDescription,
} from "@/components/ui/card";

import { DashboardAreaChart } from "./dashboard-area-chart";

export const ChartAreaSales = ({ data }: { data: DashboardSummary }) => {
  return (
    <Card className="pt-0">
      <CardHeader className="flex flex-col items-start gap-2 space-y-0 border-b py-5 sm:flex-row sm:items-center">
        <div className="grid flex-1 gap-1">
          <CardTitle>Doanh thu & Số đơn hàng</CardTitle>
          <CardDescription>
            Thống kê theo khoảng thời gian đã chọn
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <DashboardAreaChart data={data} />
      </CardContent>
    </Card>
  );
};
