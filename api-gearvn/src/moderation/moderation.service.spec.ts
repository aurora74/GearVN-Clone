import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

import { UserRole } from '../auth/enums/user-role.enum';
import { ModerationService } from './moderation.service';

describe('ModerationService', () => {
  const auditService = {
    record: jest.fn().mockResolvedValue({}),
  };

  let service: ModerationService;

  beforeEach(() => {
    auditService.record.mockClear();
    service = new ModerationService(auditService as any);
  });

  it('rejects a blank moderation reason', () => {
    expect(() => service.assertModerationReason('   ')).toThrow(
      BadRequestException,
    );
  });

  it('records moderation audit entries with the internal reason', async () => {
    const actorId = new Types.ObjectId().toString();
    const targetId = new Types.ObjectId().toString();

    await service.recordModerationAudit({
      actor: { id: actorId, role: UserRole.CSR },
      action: 'hide',
      targetType: 'product-review',
      targetId,
      reason: 'Noi dung vi pham',
      metadata: { productId: new Types.ObjectId().toString() },
    });

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId,
        actorRole: UserRole.CSR,
        action: 'MODERATION_HIDE',
        targetType: 'product-review',
        targetId,
        reason: 'Noi dung vi pham',
        metadata: expect.objectContaining({ productId: expect.any(String) }),
      }),
    );
  });
});
