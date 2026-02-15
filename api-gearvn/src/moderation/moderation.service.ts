import { BadRequestException, Injectable } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { UserRole } from '../auth/enums/user-role.enum';

export interface ModerationActor {
  id?: string;
  _id?: string;
  role?: UserRole;
}

export type ModerationAction = 'hide' | 'delete';

export interface ModerationAuditInput {
  actor: ModerationActor;
  action: ModerationAction;
  targetType: string;
  targetId?: string;
  reason: string;
  metadata?: Record<string, any>;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class ModerationService {
  constructor(private readonly auditService: AuditService) {}

  assertModerationReason(reason?: string): string {
    const normalized = reason?.trim();

    if (!normalized) {
      throw new BadRequestException('Moderation reason is required');
    }

    return normalized;
  }

  recordModerationAudit(input: ModerationAuditInput) {
    const reason = this.assertModerationReason(input.reason);
    const actorId = input.actor?.id ?? input.actor?._id;

    return this.auditService.record({
      actorId: actorId ? String(actorId) : undefined,
      actorRole: input.actor?.role,
      action: `MODERATION_${input.action.toUpperCase()}`,
      targetType: input.targetType,
      targetId: input.targetId,
      reason,
      metadata: input.metadata,
      ip: input.ip,
      userAgent: input.userAgent,
    });
  }
}
