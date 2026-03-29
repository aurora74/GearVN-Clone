import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AuditModule } from '../audit/audit.module';
import { VoucherController } from './voucher.controller';
import { VoucherService } from './voucher.service';
import { Voucher, VoucherSchema } from './voucher.schema';

@Module({
  imports: [
    AuditModule,
    MongooseModule.forFeature([{ name: Voucher.name, schema: VoucherSchema }]),
  ],
  controllers: [VoucherController],
  providers: [VoucherService],
  exports: [VoucherService],
})
export class VoucherModule {}
