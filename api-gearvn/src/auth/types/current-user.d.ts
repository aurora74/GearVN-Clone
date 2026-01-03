import { UserRole } from '../enums/user-role.enum';

export type currentUser = {
  id: string;
  role: UserRole;
};
