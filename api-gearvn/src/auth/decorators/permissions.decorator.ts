import { SetMetadata } from '@nestjs/common';

import { Permission } from '../policy/permissions';

export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (
  ...permissions: [Permission, ...Permission[]]
) => SetMetadata(PERMISSIONS_KEY, permissions);
