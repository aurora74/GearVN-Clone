import { ForbiddenException } from '@nestjs/common';

import { UserRole } from '../enums/user-role.enum';
import { Permission, roleHasPermission } from './permissions';

export interface OwnershipActor {
  id?: string;
  _id?: string;
  role?: UserRole;
}

export interface AssertOwnerOrPermissionOptions {
  actor?: OwnershipActor | null;
  ownerId?: string | { toString(): string } | null;
  permission: Permission;
  targetType: string;
}

export const assertOwnerOrPermission = ({
  actor,
  ownerId,
  permission,
  targetType,
}: AssertOwnerOrPermissionOptions): void => {
  const actorId = actor?.id ?? actor?._id;

  if (actorId != null && ownerId != null && String(actorId) === String(ownerId)) {
    return;
  }

  if (actor?.role && roleHasPermission(actor.role, permission)) {
    return;
  }

  throw new ForbiddenException(`${targetType} access requires ownership or permission`);
};
