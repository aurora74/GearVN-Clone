import { AuditService } from './audit.service';
import { UserRole } from '../auth/enums/user-role.enum';

describe('AuditService', () => {
  describe('record', () => {
    it('passes the audit event fields to the model', async () => {
      const auditModel = {
        create: jest.fn().mockResolvedValue({ _id: 'audit-id' }),
      };
      const service = new AuditService(auditModel as any);
      const metadata = { status: 'BANNED', previousStatus: 'VERIFIED' };

      await service.record({
        actorId: 'admin-id',
        actorRole: UserRole.ADMIN,
        action: 'account.status_changed',
        targetType: 'user',
        targetId: 'user-id',
        reason: 'Policy violation',
        metadata,
        ip: '127.0.0.1',
        userAgent: 'jest',
      });

      expect(auditModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'account.status_changed',
          targetType: 'user',
          reason: 'Policy violation',
          metadata,
        }),
      );
    });
  });
});
