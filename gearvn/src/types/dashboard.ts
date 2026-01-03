export type DashboardCardItem = {
  title: string;
  value: string;
  trend: "up" | "down" | null;
  trendValue: string;
  trendDescription: string;
  footerDescription: string;
};

export type TopProduct = {
  _id: string;
  name: string;
  images: string[];
  soldQuantity: number;
};

export type SalesOrdersTrendItem = {
  sales: number;
  orders: number;
  date: string;
};

export type DashboardSummary = {
  totalRevenue: number;
  revenueGrowth: number;
  ordersCount: number;
  ordersGrowth: number;
  newCustomers: number;
  newCustomersDecline: number;
  topProduct: TopProduct | null;
  salesOrdersTrend: SalesOrdersTrendItem[];
};
