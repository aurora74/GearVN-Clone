import { UserRole } from '../enums/user-role.enum';
import {
  Permission,
  ROLE_PERMISSIONS,
  roleHasAnyPermission,
  roleHasEveryPermission,
  roleHasPermission,
} from './permissions';

describe('permission policy', () => {
  const businessPermissions = [
    Permission.DASHBOARD_VIEW,
    Permission.CATALOG_MANAGE,
    Permission.CONTENT_MANAGE,
    Permission.PROMOTION_MANAGE,
    Permission.ORDER_MANAGE,
    Permission.INVENTORY_MANAGE,
    Permission.CSR_SUPPORT_MANAGE,
  ];

  it('keeps Admin limited to governance, config, account, and audit permissions', () => {
    expect(ROLE_PERMISSIONS[UserRole.ADMIN]).toEqual([
      Permission.SYSTEM_CONFIG_MANAGE,
      Permission.ACCOUNT_MANAGER_CREATE,
      Permission.ACCOUNT_USER_GOVERN,
      Permission.AUDIT_READ,
    ]);
    expect(ROLE_PERMISSIONS[UserRole.ADMIN]).not.toEqual(
      expect.arrayContaining(businessPermissions),
    );
  });

  it('allows Manager to satisfy every business workflow plus staff governance', () => {
    expect(ROLE_PERMISSIONS[UserRole.MANAGER]).toEqual(
      expect.arrayContaining([
        ...businessPermissions,
        Permission.STAFF_MANAGE,
        Permission.AUDIT_READ,
      ]),
    );
    expect(
      roleHasEveryPermission(UserRole.MANAGER, [
        ...businessPermissions,
        Permission.STAFF_MANAGE,
      ]),
    ).toBe(true);
  });

  it('limits Product & Marketing Staff to catalog, content, and promotion workflows', () => {
    expect(ROLE_PERMISSIONS[UserRole.PRODUCT_MARKETING_STAFF]).toEqual([
      Permission.CATALOG_MANAGE,
      Permission.CONTENT_MANAGE,
      Permission.PROMOTION_MANAGE,
    ]);
    expect(
      roleHasPermission(
        UserRole.PRODUCT_MARKETING_STAFF,
        Permission.ORDER_MANAGE,
      ),
    ).toBe(false);
    expect(
      roleHasPermission(
        UserRole.PRODUCT_MARKETING_STAFF,
        Permission.CSR_SUPPORT_MANAGE,
      ),
    ).toBe(false);
  });

  it('limits Sales & Operations Staff to order and inventory workflows', () => {
    expect(ROLE_PERMISSIONS[UserRole.SALES_OPERATIONS_STAFF]).toEqual([
      Permission.ORDER_MANAGE,
      Permission.INVENTORY_MANAGE,
    ]);
    expect(
      roleHasPermission(
        UserRole.SALES_OPERATIONS_STAFF,
        Permission.CATALOG_MANAGE,
      ),
    ).toBe(false);
    expect(
      roleHasPermission(
        UserRole.SALES_OPERATIONS_STAFF,
        Permission.CSR_SUPPORT_MANAGE,
      ),
    ).toBe(false);
  });

  it('limits CSR to customer support workflows', () => {
    expect(ROLE_PERMISSIONS[UserRole.CSR]).toEqual([
      Permission.CSR_SUPPORT_MANAGE,
    ]);
    expect(roleHasPermission(UserRole.CSR, Permission.ORDER_MANAGE)).toBe(
      false,
    );
    expect(roleHasPermission(UserRole.CSR, Permission.CONTENT_MANAGE)).toBe(
      false,
    );
  });

  it('limits Customer to customer account and order permissions', () => {
    expect(ROLE_PERMISSIONS[UserRole.CUSTOMER]).toEqual([
      Permission.CUSTOMER_ACCOUNT_MANAGE,
      Permission.CUSTOMER_ORDER_READ,
      Permission.CUSTOMER_ORDER_MUTATE,
    ]);
    expect(
      roleHasEveryPermission(UserRole.CUSTOMER, [
        Permission.CUSTOMER_ACCOUNT_MANAGE,
        Permission.CUSTOMER_ORDER_READ,
      ]),
    ).toBe(true);
    expect(
      roleHasPermission(UserRole.CUSTOMER, Permission.DASHBOARD_VIEW),
    ).toBe(false);
  });

  it('allows alternate permission checks without granting broader role permissions', () => {
    expect(
      roleHasAnyPermission(UserRole.SALES_OPERATIONS_STAFF, [
        Permission.CATALOG_MANAGE,
        Permission.INVENTORY_MANAGE,
      ]),
    ).toBe(true);
    expect(
      roleHasEveryPermission(UserRole.SALES_OPERATIONS_STAFF, [
        Permission.CATALOG_MANAGE,
        Permission.INVENTORY_MANAGE,
      ]),
    ).toBe(false);
  });
});
