export type DashboardSummaryPreset = "7d" | "30d" | "90d" | "custom";

export type DashboardSummaryParams = {
  preset?: DashboardSummaryPreset;
  startDate?: string;
  endDate?: string;
};

export type DashboardDateRange = {
  preset: DashboardSummaryPreset;
  currentStart: string | Date;
  currentEnd: string | Date;
  previousStart: string | Date;
  previousEnd: string | Date;
};

export type DashboardComparison = {
  previousStart: string | Date;
  previousEnd: string | Date;
  revenueGrowth: number;
  ordersGrowth: number;
  customerGrowth: number;
};

export type DashboardKpis = {
  totalRevenue: number;
  ordersCount: number;
  newCustomers: number;
  totalCustomers: number;
  totalProducts: number;
  activeProducts: number;
};

export type DashboardPaymentBreakdownItem = {
  paymentMethod: string;
  revenue: number;
  orders: number;
};

export type DashboardPipeline = {
  processing: number;
  shipping: number;
  paymentPending: number;
  cancelled: number;
};

export type DashboardTrendItem = {
  date: string;
  sales: number;
  orders: number;
};

export type DashboardProductMetric = {
  _id: string;
  name: string;
  images?: string[];
  soldQuantity: number;
  stock?: number;
  isPublished?: boolean;
};

export type DashboardProductPerformance = {
  topSellers: DashboardProductMetric[];
  topProduct: DashboardProductMetric | null;
};

export type DashboardStockAlerts = {
  lowStockProducts: DashboardProductMetric[];
  outOfStockProducts: DashboardProductMetric[];
  unpublishedLowStockCount: number;
};

export type DashboardPromotionSummary = {
  activeFlashSales: number;
  scheduledFlashSales: number;
  endedFlashSales: number;
  activeVouchers: number;
  totalVoucherUses: number;
  totalVoucherDiscountAmount: number;
  flashSaleOrdersCount: number;
  flashSaleProductsSold: number;
};

export type DashboardPromotionCampaign = {
  id: string;
  name: string;
  type: "flash_sale" | "voucher";
  orders?: number;
  productsSold?: number;
  uses?: number;
  discountAmount: number;
};

export type DashboardPromotionAnalytics = {
  summary: DashboardPromotionSummary;
  topCampaigns: DashboardPromotionCampaign[];
};
export type DashboardCardItem = {
  title: string;
  value: string;
  trend: "up" | "down" | null;
  trendValue: string;
  trendDescription: string;
  footerDescription: string;
};

export type TopProduct = DashboardProductMetric;

export type SalesOrdersTrendItem = DashboardTrendItem;

export type DashboardSummary = {
  dateRange: DashboardDateRange;
  comparison: DashboardComparison;
  kpis: DashboardKpis;
  paymentBreakdown: DashboardPaymentBreakdownItem[];
  pipeline: DashboardPipeline;
  salesOrdersTrend: DashboardTrendItem[];
  productPerformance: DashboardProductPerformance;
  stockAlerts: DashboardStockAlerts;
  promotionAnalytics: DashboardPromotionAnalytics;

  totalRevenue: number;
  revenueGrowth: number;
  ordersCount: number;
  ordersGrowth: number;
  newCustomers: number;
  newCustomersDecline: number;
  topProduct: TopProduct | null;
};
