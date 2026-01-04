import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import {
  ANY_PERMISSIONS_KEY,
  PERMISSIONS_KEY,
} from '../decorators/permissions.decorator';
import { UserRole } from '../enums/user-role.enum';
import {
  Permission,
  roleHasAnyPermission,
  roleHasEveryPermission,
} from '../policy/permissions';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    const requiredAnyPermissions = this.reflector.getAllAndOverride<
      Permission[]
    >(ANY_PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredPermissions?.length && !requiredAnyPermissions?.length) {
      return true;
    }

    const user = context.switchToHttp().getRequest().user;

    if (!user?.role) {
      throw new ForbiddenException('Missing authenticated user role');
    }

    const role = user.role as UserRole;
    const satisfiesEvery =
      !requiredPermissions?.length ||
      roleHasEveryPermission(role, requiredPermissions);
    const satisfiesAny =
      !requiredAnyPermissions?.length ||
      roleHasAnyPermission(role, requiredAnyPermissions);

    return satisfiesEvery && satisfiesAny;
  }
}
