import { SetMetadata } from '@nestjs/common';

import { Permission } from '../policy/permissions';

export const PERMISSIONS_KEY = 'permissions';
export const ANY_PERMISSIONS_KEY = 'anyPermissions';

export const Permissions = (...permissions: [Permission, ...Permission[]]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const AnyPermissions = (...permissions: [Permission, ...Permission[]]) =>
  SetMetadata(ANY_PERMISSIONS_KEY, permissions);
