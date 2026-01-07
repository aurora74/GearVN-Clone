import { BadRequestException } from '@nestjs/common';

import { UserRole } from '../auth/enums/user-role.enum';
import { SystemConfigService } from './system-config.service';

describe('SystemConfigService', () => {
  const actor = { id: 'admin-id', role: UserRole.ADMIN };
  const requestContext = { ip: '127.0.0.1', userAgent: 'jest' };
  let systemConfigModel: any;
  let auditService: { record: jest.Mock };
  let service: SystemConfigService;

  beforeEach(() => {
    systemConfigModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      }),
      findOneAndUpdate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          key: 'checkout.enabled',
          value: { enabled: true },
        }),
      }),
    };
    auditService = {
      record: jest.fn().mockResolvedValue({ _id: 'audit-id' }),
    };
    service = new SystemConfigService(systemConfigModel, auditService as any);
  });

  it('rejects mutation without a non-empty reason before persisting', async () => {
    await expect(
      service.updateConfig(actor, 'checkout.enabled', {
        value: { enabled: true },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(systemConfigModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('upserts config and records a system config audit event', async () => {
    const result = await service.updateConfig(
      actor,
      'checkout.enabled',
      {
        value: { enabled: true },
        reason: 'Enable controlled rollout',
      },
      requestContext,
    );

    expect(result).toEqual({
      key: 'checkout.enabled',
      value: { enabled: true },
    });
    expect(systemConfigModel.findOneAndUpdate).toHaveBeenCalledWith(
      { key: 'checkout.enabled' },
      {
        $set: {
          key: 'checkout.enabled',
          value: { enabled: true },
          description: undefined,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-id',
        actorRole: UserRole.ADMIN,
        action: 'SYSTEM_CONFIG_UPDATED',
        targetType: 'system-config',
        targetId: 'checkout.enabled',
        reason: 'Enable controlled rollout',
        ip: '127.0.0.1',
        userAgent: 'jest',
      }),
    );
  });
});
