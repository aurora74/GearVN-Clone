import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { UserRole } from '../enums/user-role.enum';
import { RolesGuard } from './roles.guard';

const createContext = (user?: { role?: UserRole }): ExecutionContext =>
  ({
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  };
  let guard: RolesGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('allows requests when no role metadata exists', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('rejects role metadata when authenticated user is missing', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    expect(() => guard.canActivate(createContext())).toThrow(
      'Missing authenticated user role',
    );
  });

  it('rejects a user without an allowed role', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    expect(guard.canActivate(createContext({ role: UserRole.CUSTOMER }))).toBe(
      false,
    );
  });

  it('allows a user with an allowed role', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.MANAGER]);

    expect(guard.canActivate(createContext({ role: UserRole.MANAGER }))).toBe(
      true,
    );
  });
});
