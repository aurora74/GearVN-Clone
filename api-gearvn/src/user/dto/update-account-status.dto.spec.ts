import { BadRequestException, ValidationPipe } from '@nestjs/common';

import { AccountStatus } from '../../auth/enums/account-status.enum';
import { UpdateAccountStatusDto } from './update-account-status.dto';

describe('UpdateAccountStatusDto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  const metadata = {
    type: 'body' as const,
    metatype: UpdateAccountStatusDto,
  };

  it('accepts account status updates with a governance reason', async () => {
    await expect(
      pipe.transform(
        { status: AccountStatus.BANNED, reason: 'Policy violation' },
        metadata,
      ),
    ).resolves.toMatchObject({
      status: AccountStatus.BANNED,
      reason: 'Policy violation',
    });
  });

  it('rejects unsupported account status values', async () => {
    await expect(
      pipe.transform(
        { status: 'DISABLED', reason: 'Policy violation' },
        metadata,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
