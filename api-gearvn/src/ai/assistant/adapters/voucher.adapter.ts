import { randomUUID } from 'crypto';
import { Injectable, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { VoucherDiscountType } from '../../../voucher/enums/voucher-discount-type';
import { Voucher, VoucherDocument } from '../../../voucher/voucher.schema';
import { VoucherService } from '../../../voucher/voucher.service';

export interface VoucherListParams {
  customerId?: string;
  subtotal?: number;
}

export interface VoucherValidateParams extends VoucherListParams {
  code: string;
  subtotal: number;
}

@Injectable()
export class VoucherAdapter {
  constructor(
    @Optional() private readonly voucherService?: VoucherService,
    @Optional()
    @InjectModel(Voucher.name)
    private readonly voucherModel?: Model<VoucherDocument>,
  ) {}

  async listPublic(_params: VoucherListParams = {}) {
    if (this.voucherService) return this.voucherService.listPublic();
    if (!this.voucherModel) return [];
    const now = new Date();
    const vouchers = await this.voucherModel
      .find({
        isEnabled: true,
        startsAt: { $lte: now },
        endsAt: { $gt: now },
        $expr: { $lt: ['$usedCount', '$usageLimit'] },
      })
      .sort({ endsAt: 1 })
      .lean()
      .exec();
    return vouchers.map((voucher) => toPublicVoucher(voucher, now));
  }

  async validatePublic(params: VoucherValidateParams) {
    if (!this.voucherService) {
      return this.validatePublicByModel(params);
    }

    try {
      const result = await this.voucherService.validatePublic(
        params.code,
        params.subtotal,
      );
      return { ...result, valid: true };
    } catch (error: any) {
      return {
        code: params.code,
        valid: false,
        reason: error?.response?.detail?.code ?? 'invalid_voucher',
      };
    }
  }

  async createDraft(draft: any) {
    return {
      ...draft,
      draftId: `draft-${randomUUID()}`,
      status: 'pending',
      confirmedByBackend: false,
      requiresConfirmation: true,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };
  }
  private async validatePublicByModel(params: VoucherValidateParams) {
    if (!this.voucherModel) {
      return { code: params.code, valid: false, reason: 'voucher_service_unavailable' };
    }
    const now = new Date();
    const codeNormalized = params.code.trim().toUpperCase();
    const voucher = await this.voucherModel.findOne({ codeNormalized }).lean().exec();
    if (!voucher) return { code: params.code, valid: false, reason: 'VOUCHER_INVALID' };
    if (!voucher.isEnabled) return { code: voucher.code, valid: false, reason: 'VOUCHER_NOT_ACTIVE' };
    if (voucher.startsAt > now || voucher.endsAt <= now) {
      return { code: voucher.code, valid: false, reason: 'VOUCHER_EXPIRED' };
    }
    if (Number(voucher.usedCount ?? 0) >= Number(voucher.usageLimit ?? 0)) {
      return { code: voucher.code, valid: false, reason: 'VOUCHER_USAGE_LIMIT' };
    }
    if (params.subtotal < Number(voucher.minimumOrderValue ?? 0)) {
      return { code: voucher.code, valid: false, reason: 'VOUCHER_MINIMUM_NOT_MET' };
    }
    return {
      ...toPublicVoucher(voucher, now),
      discountAmount: calculateDiscount(voucher, params.subtotal),
      valid: true,
    };
  }
  async createOrder(): Promise<never> {
    throw new Error('Assistant never creates orders directly');
  }

  async createPayment(): Promise<never> {
    throw new Error('Assistant never creates payments directly');
  }

  async decrementInventory(): Promise<never> {
    throw new Error('Assistant never mutates inventory directly');
  }

  async reserveVoucher(): Promise<never> {
    throw new Error('Assistant never reserves vouchers before checkout');
  }
}

function toPublicVoucher(voucher: any, now: Date) {
  return {
    id: String(voucher._id ?? voucher.id),
    code: voucher.code,
    discountType: voucher.discountType,
    discountValue: voucher.discountValue,
    minimumOrderValue: voucher.minimumOrderValue,
    maximumDiscountAmount: voucher.maximumDiscountAmount,
    startsAt: voucher.startsAt,
    endsAt: voucher.endsAt,
    status: voucher.startsAt > now ? 'scheduled' : 'active',
  };
}

function calculateDiscount(voucher: any, subtotal: number): number {
  const rawDiscount =
    voucher.discountType === VoucherDiscountType.PERCENTAGE
      ? (subtotal * Number(voucher.discountValue ?? 0)) / 100
      : Number(voucher.discountValue ?? 0);
  const cappedDiscount =
    voucher.maximumDiscountAmount === undefined
      ? rawDiscount
      : Math.min(rawDiscount, Number(voucher.maximumDiscountAmount));
  return Math.max(0, Math.min(subtotal, Math.floor(cappedDiscount)));
}
