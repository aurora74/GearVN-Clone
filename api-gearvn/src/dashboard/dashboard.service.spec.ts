import { BadRequestException } from '@nestjs/common';

jest.mock('src/user/user.service', () => ({ UserService: class UserService {} }), {
  virtual: true,
});
jest.mock('src/order/order.service', () => ({ OrderService: class OrderService {} }), {
  virtual: true,
});
jest.mock(
  'src/product/product.service',
  () => ({ ProductService: class ProductService {} }),
  { virtual: true },
);
jest.mock(
  'src/promotion/promotion.service',
  () => ({ PromotionService: class PromotionService {} }),
  { virtual: true },
);
import { DashboardService } from './dashboard.service';

describe('DashboardService date range normalization', () => {
  const userService = {
    getNewCustomersCount: jest.fn().mockResolvedValue(0),
    getNewCustomersDecline: jest.fn().mockResolvedValue(0),
    getCustomersCount: jest.fn().mockResolvedValue(10),
  };
  const orderService = {
    getTotalRevenue: jest.fn().mockResolvedValue(0),
    getRevenueGrowth: jest.fn().mockResolvedValue(0),
    getOrdersCount: jest.fn().mockResolvedValue(0),
    getOrdersGrowth: jest.fn().mockResolvedValue(0),
    getSalesAndOrdersByDate: jest.fn().mockResolvedValue([]),
    getCompletedRevenueByPaymentMethod: jest.fn().mockResolvedValue([]),
    getOrderPipelineSummary: jest.fn().mockResolvedValue({
      processing: 0,
      shipping: 0,
      paymentPending: 0,
      cancelled: 0,
    }),
    getTopSellingProducts: jest.fn().mockResolvedValue([
      { _id: 'product-1', name: 'Period seller', images: [], soldQuantity: 6 },
    ]),
  };
  const productService = {
    getTopSellingProduct: jest.fn().mockResolvedValue(null),
    getProductAnalytics: jest.fn().mockResolvedValue({
      totalProducts: 4,
      activeProducts: 3,
      topSellers: [],
      lowStockProducts: [],
      outOfStockProducts: [],
      unpublishedLowStockCount: 0,
    }),
  };
  const promotionService = {
    getAnalyticsSummary: jest.fn().mockResolvedValue({
      summary: {
        activeFlashSales: 1,
        scheduledFlashSales: 0,
        endedFlashSales: 0,
        activeVouchers: 2,
        totalVoucherUses: 3,
        totalVoucherDiscountAmount: 120000,
        flashSaleOrdersCount: 4,
        flashSaleProductsSold: 5,
      },
      topCampaigns: [],
    }),
  };
  let service: DashboardService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DashboardService(
      userService as any,
      orderService as any,
      productService as any,
      promotionService as any,
    );
  });

  it('uses the last 30 days by default and computes the previous equivalent period', async () => {
    const now = new Date('2026-05-03T12:00:00.000Z');
    const range = (service as any).resolveDateRange({}, now);

    expect(range.preset).toBe('30d');
    expect(range.currentEnd).toEqual(now);
    expect(range.currentStart).toEqual(new Date('2026-04-03T12:00:00.000Z'));
    expect(range.previousEnd).toEqual(new Date('2026-04-03T11:59:59.999Z'));
    expect(range.previousStart).toEqual(new Date('2026-03-04T11:59:59.999Z'));
  });

  it('rejects reversed custom ranges before querying analytics helpers', async () => {
    await expect(
      service.getSummary({
        preset: 'custom',
        startDate: '2026-05-03T00:00:00.000Z',
        endDate: '2026-05-01T00:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(orderService.getTotalRevenue).not.toHaveBeenCalled();
  });

  it('returns expanded analytics sections while preserving legacy fields', async () => {
    const result = await service.getSummary({ preset: '7d' });

    expect(result).toEqual(
      expect.objectContaining({
        dateRange: expect.objectContaining({ preset: '7d' }),
        comparison: expect.objectContaining({ customerGrowth: 0 }),
        kpis: expect.objectContaining({ totalCustomers: 10, totalProducts: 4 }),
        paymentBreakdown: [],
        pipeline: expect.objectContaining({ paymentPending: 0 }),
        salesOrdersTrend: [],
        productPerformance: expect.objectContaining({
          topSellers: [
            { _id: 'product-1', name: 'Period seller', images: [], soldQuantity: 6 },
          ],
        }),
        stockAlerts: expect.objectContaining({ outOfStockProducts: [] }),
        promotionAnalytics: expect.objectContaining({ topCampaigns: [] }),
        totalRevenue: 0,
        ordersCount: 0,
        newCustomers: 0,
        topProduct: null,
      }),
    );
    expect(orderService.getTopSellingProducts).toHaveBeenCalledWith(
      expect.any(Date),
      expect.any(Date),
      5,
    );
  });
});
