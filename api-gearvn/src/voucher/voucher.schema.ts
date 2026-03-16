import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { VoucherDiscountType } from './enums/voucher-discount-type';

export type VoucherDocument = HydratedDocument<Voucher>;

@Schema({ timestamps: true })
export class Voucher {
  @Prop({ required: true, trim: true })
  code: string;

  @Prop({ required: true, uppercase: true, trim: true })
  codeNormalized: string;

  @Prop({ required: true, enum: VoucherDiscountType })
  discountType: VoucherDiscountType;

  @Prop({ required: true, min: 0 })
  discountValue: number;

  @Prop({ required: true, min: 0 })
  minimumOrderValue: number;

  @Prop({ required: false, min: 0 })
  maximumDiscountAmount?: number;

  @Prop({ required: true })
  startsAt: Date;

  @Prop({ required: true })
  endsAt: Date;

  @Prop({ required: true, min: 1 })
  usageLimit: number;

  @Prop({ required: true, default: 0, min: 0 })
  usedCount: number;

  @Prop({ required: true, default: true })
  isEnabled: boolean;

  @Prop({ required: false })
  disabledAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const VoucherSchema = SchemaFactory.createForClass(Voucher);

VoucherSchema.pre('validate', function normalizeVoucherCode(next) {
  if (this.code) {
    this.code = this.code.trim();
    this.codeNormalized = this.code.toUpperCase();
  }

  next();
});

VoucherSchema.index({ codeNormalized: 1 }, { unique: true });
