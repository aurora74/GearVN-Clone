import {
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { AuthService } from './auth.service';
import { AccountStatus } from './enums/account-status.enum';
import { UserRole } from './enums/user-role.enum';

describe('AuthService mail side effects', () => {
  let jwtService: { signAsync: jest.Mock };
  let mailService: {
    sendUserConfirmation: jest.Mock;
    sendResetPassword: jest.Mock;
  };
  let userService: {
    findByEmail: jest.Mock;
    create: jest.Mock;
    deleteJustCreatedUnverifiedCustomer: jest.Mock;
  };
  let service: AuthService;

  const registerDto = {
    fullName: 'Test Customer',
    email: 'customer@example.com',
    password: 'StrongPass1!',
  };

  const createdUser = {
    id: 'created-user-id',
    _id: 'created-user-id',
    fullName: 'Test Customer',
    email: 'customer@example.com',
    role: UserRole.CUSTOMER,
    status: AccountStatus.UNVERIFIED,
  };

  beforeEach(() => {
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('email-token'),
    };
    mailService = {
      sendUserConfirmation: jest.fn().mockResolvedValue(undefined),
      sendResetPassword: jest.fn().mockResolvedValue(undefined),
    };
    userService = {
      findByEmail: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(createdUser),
      deleteJustCreatedUnverifiedCustomer: jest.fn().mockResolvedValue({
        deletedCount: 1,
      }),
    };

    service = new AuthService(
      jwtService as any,
      mailService as any,
      userService as any,
      { secret: 'email-secret', expiresIn: '15m' } as any,
      { secret: 'refresh-secret', expiresIn: '7d' } as any,
    );
  });

  it('registers a new customer and sends a confirmation email', async () => {
    const result = await service.register(registerDto);

    expect(userService.findByEmail).toHaveBeenCalledWith(registerDto.email);
    expect(userService.create).toHaveBeenCalledWith(registerDto);
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      { sub: 'created-user-id', email: registerDto.email },
      { secret: 'email-secret', expiresIn: '15m' },
    );
    expect(mailService.sendUserConfirmation).toHaveBeenCalledWith(
      createdUser,
      'email-token',
    );
    expect(userService.deleteJustCreatedUnverifiedCustomer).not.toHaveBeenCalled();
    expect(result).toBe(createdUser);
  });

  it('cleans up the just-created unverified customer when confirmation email fails', async () => {
    mailService.sendUserConfirmation.mockRejectedValueOnce(
      new Error('resend unavailable'),
    );

    await expect(service.register(registerDto)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    expect(userService.deleteJustCreatedUnverifiedCustomer).toHaveBeenCalledWith(
      'created-user-id',
      registerDto.email,
    );
  });

  it('keeps existing duplicate email behavior unchanged', async () => {
    userService.findByEmail.mockResolvedValueOnce({
      id: 'existing-user-id',
      email: registerDto.email,
    });

    await expect(service.register(registerDto)).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(userService.create).not.toHaveBeenCalled();
    expect(mailService.sendUserConfirmation).not.toHaveBeenCalled();
    expect(userService.deleteJustCreatedUnverifiedCustomer).not.toHaveBeenCalled();
  });

  it('surfaces password reset mail failures as service unavailable', async () => {
    userService.findByEmail.mockResolvedValueOnce({
      id: 'reset-user-id',
      email: registerDto.email,
      fullName: 'Reset User',
    });
    mailService.sendResetPassword.mockRejectedValueOnce(
      new Error('template missing'),
    );

    await expect(service.forgotPassword(registerDto.email)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    expect(jwtService.signAsync).toHaveBeenCalledWith(
      { sub: 'reset-user-id', email: registerDto.email },
      { secret: 'email-secret', expiresIn: '15m' },
    );
  });
});
