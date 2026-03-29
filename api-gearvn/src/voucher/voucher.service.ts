import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { AuditService } from '../audit/audit.service';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';
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

export interface VoucherActor {
  id?: string;
  _id?: string;
  role?: any;
}

export interface VoucherRequestContext {
  ip?: string;
  userAgent?: string;
}

export interface VoucherListQuery {
  page?: number;
  limit?: number;
  search?: string;
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

  async create(
    dto: CreateVoucherDto,
    actor: VoucherActor,
    requestContext: VoucherRequestContext = {},
  ): Promise<VoucherDocument> {
    const voucher = await this.voucherModel.create({
      ...dto,
      code: dto.code.trim(),
      codeNormalized: this.normalizeCode(dto.code),
      isEnabled: dto.isEnabled ?? true,
    });

    await this.recordVoucherAudit('VOUCHER_CREATED', voucher, actor, dto.reason, requestContext);

    return voucher;
  }

  async findAll(query: VoucherListQuery = {}) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const skip = (page - 1) * limit;
    const filter: Record<string, any> = {};

    if (query.search?.trim()) {
      filter.$or = [
        { code: { $regex: query.search.trim(), $options: 'i' } },
        { codeNormalized: { $regex: this.normalizeCode(query.search), $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.voucherModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.voucherModel.countDocuments(filter),
    ]);
    const now = new Date();

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data: data.map((voucher) => ({
        ...(typeof voucher.toObject === 'function' ? voucher.toObject() : voucher),
        status: this.getVoucherStatus(voucher, now),
      })),
    };
  }

  async findOne(id: string): Promise<VoucherDocument> {
    const voucher = await this.voucherModel.findById(id).exec();

    if (!voucher) {
      throw new NotFoundException(`Voucher ${id} not found`);
    }

    return voucher;
  }

  async listPublic(now = new Date()) {
    const vouchers = await this.voucherModel
      .find({
        isEnabled: true,
        startsAt: { $lte: now },
        endsAt: { $gt: now },
        $expr: { $lt: ['$usedCount', '$usageLimit'] },
      })
      .sort({ endsAt: 1 })
      .exec();

    return vouchers.map((voucher) => this.toPublicVoucher(voucher, now));
  }

  async validatePublic(code: string, subtotal: number, now = new Date()) {
    const { voucher, discountAmount } = await this.validateForOrder(
      code,
      subtotal,
      now,
    );

    return {
      ...this.toPublicVoucher(voucher, now),
      discountAmount,
    };
  }

  async update(
    id: string,
    dto: UpdateVoucherDto,
    actor: VoucherActor,
    requestContext: VoucherRequestContext = {},
  ): Promise<VoucherDocument> {
    const update: Record<string, any> = { ...dto };

    if (dto.code) {
      update.code = dto.code.trim();
      update.codeNormalized = this.normalizeCode(dto.code);
    }

    delete update.reason;

    const voucher = await this.voucherModel
      .findByIdAndUpdate(id, update, { new: true, runValidators: true })
      .exec();

    if (!voucher) {
      throw new NotFoundException(`Voucher ${id} not found`);
    }

    await this.recordVoucherAudit('VOUCHER_UPDATED', voucher, actor, dto.reason, requestContext);

    return voucher;
  }

  async enable(
    id: string,
    actor: VoucherActor,
    reason?: string,
    requestContext: VoucherRequestContext = {},
  ): Promise<VoucherDocument> {
    const voucher = await this.voucherModel
      .findByIdAndUpdate(
        id,
        { isEnabled: true, disabledAt: undefined },
        { new: true, runValidators: true },
      )
      .exec();

    if (!voucher) {
      throw new NotFoundException(`Voucher ${id} not found`);
    }

    await this.recordVoucherAudit('VOUCHER_ENABLED', voucher, actor, reason, requestContext);

    return voucher;
  }

  async disable(
    id: string,
    actor: VoucherActor,
    reason?: string,
    requestContext: VoucherRequestContext = {},
  ): Promise<VoucherDocument> {
    const voucher = await this.voucherModel
      .findByIdAndUpdate(
        id,
        { isEnabled: false, disabledAt: new Date() },
        { new: true, runValidators: true },
      )
      .exec();

    if (!voucher) {
      throw new NotFoundException(`Voucher ${id} not found`);
    }

    await this.recordVoucherAudit('VOUCHER_DISABLED', voucher, actor, reason, requestContext);

    return voucher;
  }

  async remove(
    id: string,
    actor: VoucherActor,
    reason?: string,
    requestContext: VoucherRequestContext = {},
  ): Promise<VoucherDocument> {
    const voucher = await this.voucherModel.findByIdAndDelete(id).exec();

    if (!voucher) {
      throw new NotFoundException(`Voucher ${id} not found`);
    }

    await this.recordVoucherAudit('VOUCHER_DELETED', voucher, actor, reason, requestContext);

    return voucher;
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

  private toPublicVoucher(voucher: VoucherDocument, now: Date) {
    return {
      code: voucher.code,
      discountType: voucher.discountType,
      discountValue: voucher.discountValue,
      minimumOrderValue: voucher.minimumOrderValue,
      maximumDiscountAmount: voucher.maximumDiscountAmount,
      startsAt: voucher.startsAt,
      endsAt: voucher.endsAt,
      status: this.getVoucherStatus(voucher, now),
    };
  }

  private getVoucherStatus(voucher: VoucherDocument, now: Date): string {
    if (!voucher.isEnabled) return 'disabled';
    if (voucher.startsAt > now) return 'scheduled';
    if (voucher.endsAt <= now) return 'expired';
    if (voucher.usedCount >= voucher.usageLimit) return 'exhausted';
    return 'active';
  }

  private async recordVoucherAudit(
    action: string,
    voucher: VoucherDocument,
    actor: VoucherActor,
    reason?: string,
    requestContext: VoucherRequestContext = {},
  ) {
    await this.auditService.record({
      actorId: String(actor?.id ?? actor?._id ?? ''),
      actorRole: actor?.role,
      action,
      targetType: 'voucher',
      targetId: String(voucher._id),
      reason,
      metadata: {
        code: voucher.code,
        discountType: voucher.discountType,
      },
      ip: requestContext.ip,
      userAgent: requestContext.userAgent,
    });
  }

  private throwVoucherError(code: VoucherFailureCode): never {
    throw new BadRequestException({
      message: 'Voucher cannot be applied',
      detail: { code },
    });
  }
}
