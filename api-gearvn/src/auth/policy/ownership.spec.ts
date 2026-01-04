import { ForbiddenException } from '@nestjs/common';

import { UserRole } from '../enums/user-role.enum';
import { Permission } from './permissions';
import { assertOwnerOrPermission } from './ownership';

describe('ownership policy', () => {
  const baseOptions = {
    ownerId: 'customer-id',
    permission: Permission.ORDER_MANAGE,
    targetType: 'order',
  };

  it('allows the resource owner', () => {
    expect(() =>
      assertOwnerOrPermission({
        ...baseOptions,
        actor: { id: 'customer-id', role: UserRole.CUSTOMER },
      }),
    ).not.toThrow();
  });

  it('allows actors with the required permission', () => {
    expect(() =>
      assertOwnerOrPermission({
        ...baseOptions,
        actor: { id: 'staff-id', role: UserRole.SALES_OPERATIONS_STAFF },
      }),
    ).not.toThrow();
  });

  it('rejects a wrong owner without the required permission', () => {
    expect(() =>
      assertOwnerOrPermission({
        ...baseOptions,
        actor: { id: 'other-customer-id', role: UserRole.CUSTOMER },
      }),
    ).toThrow(ForbiddenException);
  });

  it('rejects a missing actor', () => {
    expect(() =>
      assertOwnerOrPermission({
        ...baseOptions,
        actor: undefined,
      }),
    ).toThrow(ForbiddenException);
  });
});
