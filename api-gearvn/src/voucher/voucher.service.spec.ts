import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

import { VoucherDiscountType } from './enums/voucher-discount-type';
import { VoucherService } from './voucher.service';

const createVoucherModel = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn(),
});

const makeVoucher = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(),
  code: 'SAVE10',
  codeNormalized: 'SAVE10',
  discountType: VoucherDiscountType.PERCENTAGE,
  discountValue: 10,
  minimumOrderValue: 100000,
  maximumDiscountAmount: undefined,
  startsAt: new Date('2026-01-01T00:00:00.000Z'),
  endsAt: new Date('2026-12-31T00:00:00.000Z'),
  usageLimit: 5,
  usedCount: 0,
  isEnabled: true,
  ...overrides,
});

const expectVoucherError = async (
  promise: Promise<unknown>,
  code: string,
) => {
  await expect(promise).rejects.toMatchObject({
    response: expect.objectContaining({
      detail: expect.objectContaining({ code }),
    }),
  });
};

describe('VoucherService', () => {
  const now = new Date('2026-05-02T00:00:00.000Z');
  let voucherModel: ReturnType<typeof createVoucherModel>;
  let service: VoucherService;

  beforeEach(() => {
    voucherModel = createVoucherModel();
    service = new VoucherService(voucherModel as any, { record: jest.fn() } as any);
  });

  it('adds derived status to admin voucher list rows', async () => {
    const voucher = {
      ...makeVoucher({ startsAt: new Date('2026-06-01T00:00:00.000Z') }),
      toObject() {
        return { ...this };
      },
    };
    const query = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([voucher]),
    };
    voucherModel.find.mockReturnValue(query);
    voucherModel.countDocuments.mockResolvedValue(1);

    const result = await service.findAll({ page: 1, limit: 20 });

    expect(result.data[0]).toMatchObject({
      code: 'SAVE10',
      status: 'scheduled',
    });
  });

  it('normalizes voucher codes before lookup', async () => {
    voucherModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(makeVoucher()),
    });

    await service.validateForOrder(' save10 ', 200000, now);

    expect(service.normalizeCode(' save10 ')).toBe('SAVE10');
    expect(voucherModel.findOne).toHaveBeenCalledWith({
      codeNormalized: 'SAVE10',
    });
  });

  it('calculates percentage and fixed amount discounts', () => {
    expect(
      service.calculateDiscount(
        makeVoucher({ discountType: VoucherDiscountType.PERCENTAGE, discountValue: 15 }),
        200000,
      ),
    ).toBe(30000);

    expect(
      service.calculateDiscount(
        makeVoucher({ discountType: VoucherDiscountType.FIXED_AMOUNT, discountValue: 50000 }),
        200000,
      ),
    ).toBe(50000);
  });

  it('caps percentage and fixed amount discounts when maximumDiscountAmount is present', () => {
    expect(
      service.calculateDiscount(
        makeVoucher({
          discountType: VoucherDiscountType.PERCENTAGE,
          discountValue: 50,
          maximumDiscountAmount: 20000,
        }),
        100000,
      ),
    ).toBe(20000);

    expect(
      service.calculateDiscount(
        makeVoucher({
          discountType: VoucherDiscountType.FIXED_AMOUNT,
          discountValue: 50000,
          maximumDiscountAmount: 30000,
        }),
        100000,
      ),
    ).toBe(30000);
  });

  it('rejects vouchers that are not active yet', async () => {
    voucherModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(
        makeVoucher({ startsAt: new Date('2026-06-01T00:00:00.000Z') }),
      ),
    });

    await expectVoucherError(
      service.validateForOrder('SAVE10', 200000, now),
      'VOUCHER_NOT_ACTIVE',
    );
  });

  it('rejects expired vouchers', async () => {
    voucherModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(
        makeVoucher({ endsAt: new Date('2026-04-01T00:00:00.000Z') }),
      ),
    });

    await expectVoucherError(
      service.validateForOrder('SAVE10', 200000, now),
      'VOUCHER_EXPIRED',
    );
  });

  it('rejects disabled vouchers', async () => {
    voucherModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(makeVoucher({ isEnabled: false })),
    });

    await expectVoucherError(
      service.validateForOrder('SAVE10', 200000, now),
      'VOUCHER_INVALID',
    );
  });

  it('rejects vouchers over usage cap', async () => {
    voucherModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(makeVoucher({ usedCount: 5, usageLimit: 5 })),
    });

    await expectVoucherError(
      service.validateForOrder('SAVE10', 200000, now),
      'VOUCHER_USAGE_LIMIT',
    );
  });

  it('rejects orders below minimum order value', async () => {
    voucherModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(makeVoucher({ minimumOrderValue: 300000 })),
    });

    await expectVoucherError(
      service.validateForOrder('SAVE10', 200000, now),
      'VOUCHER_MINIMUM_NOT_MET',
    );
  });

  it('reserves voucher usage atomically and returns reservation metadata', async () => {
    const reservedVoucher = makeVoucher({
      _id: new Types.ObjectId('64f000000000000000000001'),
      discountType: VoucherDiscountType.PERCENTAGE,
      discountValue: 20,
      maximumDiscountAmount: 25000,
    });
    voucherModel.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(reservedVoucher),
    });

    const result = await service.reserveForOrder(' save10 ', 200000, now);

    expect(voucherModel.findOneAndUpdate).toHaveBeenCalledWith(
      {
        codeNormalized: 'SAVE10',
        isEnabled: true,
        startsAt: { $lte: now },
        endsAt: { $gt: now },
        minimumOrderValue: { $lte: 200000 },
        $expr: { $lt: ['$usedCount', '$usageLimit'] },
      },
      { $inc: { usedCount: 1 } },
      { new: true },
    );
    expect(result).toEqual({
      voucherId: '64f000000000000000000001',
      code: 'SAVE10',
      discountType: VoucherDiscountType.PERCENTAGE,
      discountValue: 20,
      minimumOrderValue: 100000,
      maximumDiscountAmount: 25000,
      discountAmount: 25000,
      reservedUsage: true,
      reservedAt: now,
    });
  });

  it('returns an exact failure reason when atomic reservation misses', async () => {
    voucherModel.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    voucherModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(makeVoucher({ usedCount: 5, usageLimit: 5 })),
    });

    await expectVoucherError(
      service.reserveForOrder('SAVE10', 200000, now),
      'VOUCHER_USAGE_LIMIT',
    );
  });

  it('restores a reservation with a guarded decrement', async () => {
    voucherModel.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(makeVoucher()),
    });

    await service.restoreReservation('64f000000000000000000001');

    expect(voucherModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: '64f000000000000000000001', usedCount: { $gt: 0 } },
      { $inc: { usedCount: -1 } },
      { new: true },
    );
  });

  it('returns a shallow usage summary without mutating vouchers', async () => {
    voucherModel.aggregate.mockResolvedValue([
      {
        totalVouchers: 2,
        activeVouchers: 1,
        totalUsage: 7,
        totalDiscountedAmount: 175000,
      },
    ]);

    await expect(service.getVoucherUsageSummary()).resolves.toEqual({
      totalVouchers: 2,
      activeVouchers: 1,
      totalUsage: 7,
      totalDiscountedAmount: 175000,
    });
    expect(voucherModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(voucherModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});
