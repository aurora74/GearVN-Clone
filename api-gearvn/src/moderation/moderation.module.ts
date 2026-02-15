import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { ModerationService } from './moderation.service';

@Module({
  imports: [AuditModule],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
