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

  it('does not mutate voucher reservations or order snapshots while reading summary', async () => {
    await service.getSummary();

    expect(voucherService.reserveForOrder).not.toHaveBeenCalled();
    expect(voucherService.restoreReservation).not.toHaveBeenCalled();
    expect(orderModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});
