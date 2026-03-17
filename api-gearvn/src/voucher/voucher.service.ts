import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { AuditService } from '../audit/audit.service';
import { VoucherDiscountType } from './enums/voucher-discount-type';
import { Voucher, VoucherDocument } from './voucher.schema';

export type VoucherFailureCode =
  | 'VOUCHER_INVALID'
  | 'VOUCHER_NOT_ACTIVE'
  | 'VOUCHER_EXPIRED'
  | 'VOUCHER_USAGE_LIMIT'
  | 'VOUCHER_MINIMUM_NOT_MET';

export interface VoucherReservationResult {
  voucherId: string;
  code: string;
  discountType: VoucherDiscountType;
  discountValue: number;
  minimumOrderValue: number;
  maximumDiscountAmount?: number;
  discountAmount: number;
  reservedUsage: true;
  reservedAt: Date;
}

export interface VoucherUsageSummary {
  totalVouchers: number;
  activeVouchers: number;
  totalUsage: number;
  totalDiscountedAmount: number;
}

@Injectable()
export class VoucherService {
  constructor(
    @InjectModel(Voucher.name)
    private readonly voucherModel: Model<VoucherDocument>,
    private readonly auditService: AuditService,
  ) {}

  normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  }

  calculateDiscount(
    voucher: Pick<
      Voucher,
      'discountType' | 'discountValue' | 'maximumDiscountAmount'
    >,
    subtotal: number,
  ): number {
    const rawDiscount =
      voucher.discountType === VoucherDiscountType.PERCENTAGE
        ? (subtotal * voucher.discountValue) / 100
        : voucher.discountValue;

    const cappedDiscount =
      voucher.maximumDiscountAmount === undefined
        ? rawDiscount
        : Math.min(rawDiscount, voucher.maximumDiscountAmount);

    return Math.max(0, Math.min(subtotal, Math.floor(cappedDiscount)));
  }

  async validateForOrder(
    code: string,
    subtotal: number,
    now = new Date(),
  ): Promise<{ voucher: VoucherDocument; discountAmount: number }> {
    const voucher = await this.voucherModel
      .findOne({ codeNormalized: this.normalizeCode(code) })
      .exec();

    if (!voucher?.isEnabled) {
      this.throwVoucherError('VOUCHER_INVALID');
    }

    if (voucher.startsAt > now) {
      this.throwVoucherError('VOUCHER_NOT_ACTIVE');
    }

    if (voucher.endsAt <= now) {
      this.throwVoucherError('VOUCHER_EXPIRED');
    }

    if (voucher.usedCount >= voucher.usageLimit) {
      this.throwVoucherError('VOUCHER_USAGE_LIMIT');
    }

    if (subtotal < voucher.minimumOrderValue) {
      this.throwVoucherError('VOUCHER_MINIMUM_NOT_MET');
    }

    return {
      voucher,
      discountAmount: this.calculateDiscount(voucher, subtotal),
    };
  }

  async reserveForOrder(
    code: string,
    subtotal: number,
    now = new Date(),
  ): Promise<VoucherReservationResult> {
    const codeNormalized = this.normalizeCode(code);
    const voucher = await this.voucherModel
      .findOneAndUpdate(
        {
          codeNormalized,
          isEnabled: true,
          startsAt: { $lte: now },
          endsAt: { $gt: now },
          minimumOrderValue: { $lte: subtotal },
          $expr: { $lt: ['$usedCount', '$usageLimit'] },
        },
        { $inc: { usedCount: 1 } },
        { new: true },
      )
      .exec();

    if (!voucher) {
      await this.validateForOrder(codeNormalized, subtotal, now);
      this.throwVoucherError('VOUCHER_INVALID');
    }

    return {
      voucherId: String(voucher._id),
      code: voucher.code,
      discountType: voucher.discountType,
      discountValue: voucher.discountValue,
      minimumOrderValue: voucher.minimumOrderValue,
      maximumDiscountAmount: voucher.maximumDiscountAmount,
      discountAmount: this.calculateDiscount(voucher, subtotal),
      reservedUsage: true,
      reservedAt: now,
    };
  }

  async restoreReservation(voucherId: string): Promise<VoucherDocument | null> {
    return this.voucherModel
      .findOneAndUpdate(
        { _id: voucherId, usedCount: { $gt: 0 } },
        { $inc: { usedCount: -1 } },
        { new: true },
      )
      .exec();
  }

  async getVoucherUsageSummary(): Promise<VoucherUsageSummary> {
    const [summary] = await this.voucherModel.aggregate<VoucherUsageSummary>([
      {
        $group: {
          _id: null,
          totalVouchers: { $sum: 1 },
          activeVouchers: {
            $sum: { $cond: [{ $eq: ['$isEnabled', true] }, 1, 0] },
          },
          totalUsage: { $sum: '$usedCount' },
          totalDiscountedAmount: {
            $sum: { $ifNull: ['$totalDiscountedAmount', 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalVouchers: 1,
          activeVouchers: 1,
          totalUsage: 1,
          totalDiscountedAmount: 1,
        },
      },
    ]);

    return {
      totalVouchers: summary?.totalVouchers ?? 0,
      activeVouchers: summary?.activeVouchers ?? 0,
      totalUsage: summary?.totalUsage ?? 0,
      totalDiscountedAmount: summary?.totalDiscountedAmount ?? 0,
    };
  }

  private throwVoucherError(code: VoucherFailureCode): never {
    throw new BadRequestException({
      message: 'Voucher cannot be applied',
      detail: { code },
    });
  }
}
