import { UserRole } from '../enums/user-role.enum';

export interface AuthJwtPayload {
  sub: string;
  role: UserRole.ADMIN | UserRole.CUSTOMER;
}
