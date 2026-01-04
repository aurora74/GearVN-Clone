import { UserRole } from '../enums/user-role.enum';

export enum Permission {
  SYSTEM_CONFIG_MANAGE = 'SYSTEM_CONFIG_MANAGE',
  ACCOUNT_MANAGER_CREATE = 'ACCOUNT_MANAGER_CREATE',
  ACCOUNT_USER_GOVERN = 'ACCOUNT_USER_GOVERN',
  STAFF_MANAGE = 'STAFF_MANAGE',
  DASHBOARD_VIEW = 'DASHBOARD_VIEW',
  CATALOG_MANAGE = 'CATALOG_MANAGE',
  CONTENT_MANAGE = 'CONTENT_MANAGE',
  PROMOTION_MANAGE = 'PROMOTION_MANAGE',
  ORDER_MANAGE = 'ORDER_MANAGE',
  INVENTORY_MANAGE = 'INVENTORY_MANAGE',
  CSR_SUPPORT_MANAGE = 'CSR_SUPPORT_MANAGE',
  AUDIT_READ = 'AUDIT_READ',
  CUSTOMER_ACCOUNT_MANAGE = 'CUSTOMER_ACCOUNT_MANAGE',
  CUSTOMER_ORDER_READ = 'CUSTOMER_ORDER_READ',
  CUSTOMER_ORDER_MUTATE = 'CUSTOMER_ORDER_MUTATE',
}

const BUSINESS_PERMISSIONS = [
  Permission.DASHBOARD_VIEW,
  Permission.CATALOG_MANAGE,
  Permission.CONTENT_MANAGE,
  Permission.PROMOTION_MANAGE,
  Permission.ORDER_MANAGE,
  Permission.INVENTORY_MANAGE,
  Permission.CSR_SUPPORT_MANAGE,
];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    Permission.SYSTEM_CONFIG_MANAGE,
    Permission.ACCOUNT_MANAGER_CREATE,
    Permission.ACCOUNT_USER_GOVERN,
    Permission.AUDIT_READ,
  ],
  [UserRole.MANAGER]: [
    ...BUSINESS_PERMISSIONS,
    Permission.STAFF_MANAGE,
    Permission.AUDIT_READ,
  ],
  [UserRole.PRODUCT_MARKETING_STAFF]: [
    Permission.CATALOG_MANAGE,
    Permission.CONTENT_MANAGE,
    Permission.PROMOTION_MANAGE,
  ],
  [UserRole.SALES_OPERATIONS_STAFF]: [
    Permission.ORDER_MANAGE,
    Permission.INVENTORY_MANAGE,
  ],
  [UserRole.CSR]: [Permission.CSR_SUPPORT_MANAGE],
  [UserRole.CUSTOMER]: [
    Permission.CUSTOMER_ACCOUNT_MANAGE,
    Permission.CUSTOMER_ORDER_READ,
    Permission.CUSTOMER_ORDER_MUTATE,
  ],
};

export const roleHasPermission = (
  role: UserRole,
  permission: Permission,
): boolean => ROLE_PERMISSIONS[role]?.includes(permission) ?? false;

export const roleHasEveryPermission = (
  role: UserRole,
  permissions: Permission[],
): boolean =>
  permissions.every((permission) => roleHasPermission(role, permission));

export const roleHasAnyPermission = (
  role: UserRole,
  permissions: Permission[],
): boolean =>
  permissions.some((permission) => roleHasPermission(role, permission));
