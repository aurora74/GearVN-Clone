import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { AccountStatus } from '../auth/enums/account-status.enum';
import { UserRole } from '../auth/enums/user-role.enum';
import { UserService } from './user.service';

describe('UserService account governance', () => {
  const adminActor = { id: 'admin-id', role: UserRole.ADMIN };
  const managerActor = { id: 'manager-id', role: UserRole.MANAGER };
  const requestContext = { ip: '127.0.0.1', userAgent: 'jest' };

  let userModel: any;
  let auditService: { record: jest.Mock };
  let service: UserService;

  const baseAccount = {
    fullName: 'Staff User',
    email: 'staff@example.com',
    password: 'StrongPass1!',
  };

  beforeEach(() => {
    userModel = jest.fn().mockImplementation((data) => ({
      save: jest.fn().mockResolvedValue({
        toObject: () => ({
          _id: 'created-user-id',
          ...data,
        }),
      }),
    }));
    userModel.findById = jest.fn();
    userModel.findByIdAndUpdate = jest.fn();
    userModel.findByIdAndDelete = jest.fn();
    userModel.find = jest.fn();
    userModel.findOne = jest.fn();
    userModel.countDocuments = jest.fn();

    auditService = {
      record: jest.fn().mockResolvedValue({ _id: 'audit-id' }),
    };

    service = new UserService({} as any, userModel, auditService as any);
  });

  it('rejects Manager attempts to create Admin or Manager accounts', async () => {
    await expect(
      service.createStaff(
        {
          ...baseAccount,
          role: UserRole.ADMIN,
        } as any,
        managerActor,
        requestContext,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      service.createStaff(
        {
          ...baseAccount,
          role: UserRole.MANAGER,
        } as any,
        managerActor,
        requestContext,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(userModel).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('allows Admin to create Manager accounts and records audit metadata', async () => {
    const result = await service.createManager(
      {
        fullName: 'Business Manager',
        email: 'manager@example.com',
        password: 'StrongPass1!',
      },
      adminActor,
      requestContext,
    );

    expect(userModel).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: 'Business Manager',
        email: 'manager@example.com',
        role: UserRole.MANAGER,
        status: AccountStatus.VERIFIED,
        password: expect.any(String),
      }),
    );
    expect((result as Record<string, unknown>).password).toBeUndefined();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-id',
        actorRole: UserRole.ADMIN,
        action: 'MANAGER_CREATED',
        targetType: 'user',
        targetId: 'created-user-id',
        reason: 'Manager account created',
        ip: '127.0.0.1',
        userAgent: 'jest',
      }),
    );
  });

  it('sanitizes self-profile updates to ordinary profile fields only', async () => {
    userModel.findById.mockResolvedValue({
      _id: 'customer-id',
      role: UserRole.CUSTOMER,
    });
    userModel.findByIdAndUpdate.mockResolvedValue({
      _id: 'customer-id',
      fullName: 'Updated Customer',
    });

    await service.updateProfile('customer-id', {
      fullName: 'Updated Customer',
      role: UserRole.ADMIN,
      status: AccountStatus.BANNED,
      password: 'HackedPass1!',
      refreshToken: 'refresh-token',
    } as any);

    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'customer-id',
      { fullName: 'Updated Customer' },
      { new: true, runValidators: true },
    );
  });

  it('lists customers, managers, and business staff for Admin account governance', async () => {
    const query = {
      select: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    userModel.find.mockReturnValue(query);
    userModel.countDocuments.mockResolvedValue(0);

    await service.findAll({ page: 1, limit: 20 });

    expect(userModel.find).toHaveBeenCalledWith({
      role: {
        $in: [
          UserRole.CUSTOMER,
          UserRole.MANAGER,
          UserRole.PRODUCT_MARKETING_STAFF,
          UserRole.SALES_OPERATIONS_STAFF,
          UserRole.CSR,
        ],
      },
    });
  });

  it('records staff deactivation audit events for Manager staff governance', async () => {
    const staff = {
      _id: 'staff-id',
      email: 'csr@example.com',
      role: UserRole.CSR,
      status: AccountStatus.VERIFIED,
      save: jest.fn().mockResolvedValue(undefined),
    };
    userModel.findById.mockResolvedValue(staff);

    await service.governAccountStatus(
      managerActor,
      'staff-id',
      AccountStatus.BANNED,
      { reason: 'No longer employed' },
      requestContext,
    );

    expect(staff.status).toBe(AccountStatus.BANNED);
    expect(staff.save).toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'manager-id',
        actorRole: UserRole.MANAGER,
        action: 'STAFF_DEACTIVATED',
        targetType: 'user',
        targetId: 'staff-id',
        reason: 'No longer employed',
        ip: '127.0.0.1',
        userAgent: 'jest',
      }),
    );
  });

  it('records Admin ban and delete governance audit events', async () => {
    const customer = {
      _id: 'customer-id',
      email: 'customer@example.com',
      role: UserRole.CUSTOMER,
      status: AccountStatus.VERIFIED,
      save: jest.fn().mockResolvedValue(undefined),
    };

    userModel.findById.mockResolvedValueOnce(customer).mockResolvedValueOnce(customer);
    userModel.findByIdAndDelete.mockResolvedValue(customer);

    await service.governAccountStatus(
      adminActor,
      'customer-id',
      AccountStatus.BANNED,
      { reason: 'Fraudulent checkout attempts' },
      requestContext,
    );
    await service.governAccountDeletion(
      adminActor,
      'customer-id',
      { reason: 'Confirmed duplicate abusive account' },
      requestContext,
    );

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ACCOUNT_BANNED',
        reason: 'Fraudulent checkout attempts',
        targetId: 'customer-id',
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ACCOUNT_DELETED',
        reason: 'Confirmed duplicate abusive account',
        targetId: 'customer-id',
      }),
    );
  });

  it('rejects governance mutations without a reason', async () => {
    await expect(
      service.governAccountDeletion(adminActor, 'customer-id', { reason: ' ' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(userModel.findById).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });
});
