import { PromotionService } from './promotion.service';

describe('PromotionService', () => {
  let eventService: { findAll: jest.Mock };
  let voucherService: {
    getVoucherUsageSummary: jest.Mock;
    reserveForOrder: jest.Mock;
    restoreReservation: jest.Mock;
  };
  let orderModel: { aggregate: jest.Mock; findByIdAndUpdate: jest.Mock };
  let service: PromotionService;

  beforeEach(() => {
    eventService = {
      findAll: jest.fn().mockResolvedValue({
        data: [
          { status: 'active' },
          { status: 'scheduled' },
          { status: 'ended' },
          { status: 'disabled' },
        ],
      }),
    };
    voucherService = {
      getVoucherUsageSummary: jest.fn().mockResolvedValue({
        activeVouchers: 3,
        totalUsage: 12,
        totalDiscountedAmount: 450000,
      }),
      reserveForOrder: jest.fn(),
      restoreReservation: jest.fn(),
    };
    orderModel = {
      aggregate: jest.fn().mockResolvedValue([
        {
          totalDiscountedAmount: 950000,
          flashSaleProductsCount: 4,
          flashSaleOrdersCount: 7,
        },
      ]),
      findByIdAndUpdate: jest.fn(),
    };
    service = new PromotionService(
      eventService as any,
      voucherService as any,
      orderModel as any,
    );
  });

  it('returns shallow promotion usage summary from events, vouchers, and order snapshots', async () => {
    await expect(service.getSummary()).resolves.toEqual({
      activeFlashSales: 1,
      scheduledFlashSales: 1,
      endedFlashSales: 1,
      activeVouchers: 3,
      totalVoucherUses: 12,
      totalDiscountedAmount: 950000,
      flashSaleProductsCount: 4,
      flashSaleOrdersCount: 7,
    });
  });

  it('returns date-filtered promotion analytics with top campaign rows limited to five', async () => {
    const startDate = new Date('2026-04-01T00:00:00.000Z');
    const endDate = new Date('2026-04-30T23:59:59.999Z');

    orderModel.aggregate
      .mockResolvedValueOnce([
        {
          totalVoucherUses: 6,
          totalVoucherDiscountAmount: 360000,
          flashSaleOrdersCount: 4,
          flashSaleProductsSold: 11,
        },
      ])
      .mockResolvedValueOnce([
        {
          _id: 'laptop-week',
          name: 'Laptop Week',
          orders: ['order-1', 'order-2'],
          productsSold: 8,
        },
        {
          _id: 'monitor-week',
          name: 'Monitor Week',
          orders: ['order-3'],
          productsSold: 3,
        },
      ])
      .mockResolvedValueOnce([
        { _id: 'laptop-week', discountAmount: 500000 },
        { _id: 'monitor-week', discountAmount: 100000 },
      ])
      .mockResolvedValueOnce([
        {
          _id: 'voucher-1',
          name: 'SAVE10',
          uses: 4,
          discountAmount: 400000,
        },
        {
          _id: 'voucher-2',
          name: 'SAVE20',
          uses: 2,
          discountAmount: 300000,
        },
        {
          _id: 'voucher-3',
          name: 'SAVE30',
          uses: 1,
          discountAmount: 200000,
        },
        {
          _id: 'voucher-4',
          name: 'SAVE40',
          uses: 1,
          discountAmount: 50000,
        },
      ]);

    await expect(
      service.getAnalyticsSummary(startDate, endDate),
    ).resolves.toEqual({
      summary: {
        activeFlashSales: 1,
        scheduledFlashSales: 1,
        endedFlashSales: 1,
        activeVouchers: 3,
        totalVoucherUses: 6,
        totalVoucherDiscountAmount: 360000,
        flashSaleOrdersCount: 4,
        flashSaleProductsSold: 11,
      },
      topCampaigns: [
        {
          id: 'laptop-week',
          name: 'Laptop Week',
          type: 'flash_sale',
          orders: 2,
          productsSold: 8,
          discountAmount: 500000,
        },
        {
          id: 'voucher-1',
          name: 'SAVE10',
          type: 'voucher',
          uses: 4,
          discountAmount: 400000,
        },
        {
          id: 'voucher-2',
          name: 'SAVE20',
          type: 'voucher',
          uses: 2,
          discountAmount: 300000,
        },
        {
          id: 'voucher-3',
          name: 'SAVE30',
          type: 'voucher',
          uses: 1,
          discountAmount: 200000,
        },
        {
          id: 'monitor-week',
          name: 'Monitor Week',
          type: 'flash_sale',
          orders: 1,
          productsSold: 3,
          discountAmount: 100000,
        },
      ],
    });

    expect(orderModel.aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        {
          $match: {
            orderStatus: 'COMPLETED',
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
      ]),
    );
  });

  it('does not mutate voucher reservations or order snapshots while reading analytics', async () => {
    orderModel.aggregate
      .mockResolvedValueOnce([
        {
          totalVoucherUses: 0,
          totalVoucherDiscountAmount: 0,
          flashSaleOrdersCount: 0,
          flashSaleProductsSold: 0,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await service.getAnalyticsSummary(
      new Date('2026-04-01T00:00:00.000Z'),
      new Date('2026-04-30T23:59:59.999Z'),
    );

    expect(voucherService.reserveForOrder).not.toHaveBeenCalled();
    expect(voucherService.restoreReservation).not.toHaveBeenCalled();
    expect(orderModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});
