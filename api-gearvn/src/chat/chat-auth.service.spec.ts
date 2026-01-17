import { UnauthorizedException } from '@nestjs/common';

import { UserRole } from '../auth/enums/user-role.enum';
import { ChatAuthService } from './chat-auth.service';

describe('ChatAuthService', () => {
  const jwtService = {
    verifyAsync: jest.fn(),
  };

  const service = new ChatAuthService(jwtService as any, {
    secret: 'test-secret',
  } as any);

  beforeEach(() => {
    jwtService.verifyAsync.mockReset();
  });

  it('authenticates socket actors from a verified auth token and ignores spoofed query identity', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'verified-user',
      role: UserRole.CUSTOMER,
    });

    const actor = await service.authenticateSocket({
      handshake: {
        auth: { token: 'signed-token' },
        query: { userId: 'spoofed-user', role: UserRole.ADMIN },
        headers: {},
      },
      data: {},
    } as any);

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('signed-token', {
      secret: 'test-secret',
    });
    expect(actor).toEqual({ id: 'verified-user', role: UserRole.CUSTOMER });
  });

  it('rejects sockets without a backend-verifiable token', async () => {
    await expect(
      service.authenticateSocket({
        handshake: {
          auth: {},
          query: { userId: 'spoofed-user', role: UserRole.ADMIN },
          headers: {},
        },
        data: {},
      } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
