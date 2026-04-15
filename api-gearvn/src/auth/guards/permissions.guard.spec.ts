import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ANY_PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { UserRole } from '../enums/user-role.enum';
import { Permission } from '../policy/permissions';
import { PermissionsGuard } from './permissions.guard';

const createContext = (user?: { role?: UserRole }): ExecutionContext =>
  ({
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  }) as unknown as ExecutionContext;

describe('PermissionsGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  };
  let guard: PermissionsGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new PermissionsGuard(reflector as unknown as Reflector);
  });

  it('allows requests when no permission metadata exists', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('rejects permission metadata when authenticated user is missing', () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.CATALOG_MANAGE]);

    expect(() => guard.canActivate(createContext())).toThrow(
      'Missing authenticated user role',
    );
  });

  it('rejects a role without every required permission', () => {
    reflector.getAllAndOverride.mockReturnValue([
      Permission.CATALOG_MANAGE,
      Permission.ORDER_MANAGE,
    ]);

    expect(
      guard.canActivate(
        createContext({ role: UserRole.PRODUCT_MARKETING_STAFF }),
      ),
    ).toBe(false);
  });

  it('allows a role with every required permission', () => {
    reflector.getAllAndOverride.mockReturnValue([
      Permission.CATALOG_MANAGE,
      Permission.ORDER_MANAGE,
    ]);

    expect(guard.canActivate(createContext({ role: UserRole.MANAGER }))).toBe(
      true,
    );
  });

  it('allows a role with any configured alternate permission', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === ANY_PERMISSIONS_KEY
        ? [Permission.CATALOG_MANAGE, Permission.INVENTORY_MANAGE]
        : undefined,
    );

    expect(
      guard.canActivate(
        createContext({ role: UserRole.SALES_OPERATIONS_STAFF }),
      ),
    ).toBe(true);
  });
});
