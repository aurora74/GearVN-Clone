import { hash } from 'argon2';
import { Model, Query } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { Permission, roleHasPermission } from '../auth/policy/permissions';
import {
  assertOwnerOrPermission,
  OwnershipActor,
} from '../auth/policy/ownership';
import { UserRole } from '../auth/enums/user-role.enum';
import { AccountStatus } from '../auth/enums/account-status.enum';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { User, UserDocument } from './user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateManagerDto } from './dto/create-manager.dto';
import {
  CreateStaffDto,
  STAFF_ASSIGNABLE_ROLES,
} from './dto/create-staff.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { AccountActionDto } from './dto/account-action.dto';

const STAFF_ROLE_VALUES: readonly UserRole[] = STAFF_ASSIGNABLE_ROLES;
const ACCOUNT_GOVERNANCE_LIST_ROLES: readonly UserRole[] = [
  UserRole.CUSTOMER,
  UserRole.MANAGER,
  ...STAFF_ROLE_VALUES,
];

type AssignableStaffRole = (typeof STAFF_ASSIGNABLE_ROLES)[number];

export interface AccountGovernanceActor extends OwnershipActor {}

export interface AccountGovernanceRequestContext {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class UserService {
  constructor(
    private cloudinaryService: CloudinaryService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly auditService: AuditService,
  ) {}

  async create(data: CreateUserDto) {
    return this.createAccount(data);
  }

  async createManager(
    data: CreateManagerDto,
    actor: AccountGovernanceActor,
    requestContext: AccountGovernanceRequestContext = {},
  ) {
    const manager = await this.createAccount({
      ...data,
      role: UserRole.MANAGER,
      status: AccountStatus.VERIFIED,
    });

    await this.recordAccountAudit({
      actor,
      action: 'MANAGER_CREATED',
      targetId: manager._id?.toString?.() ?? manager.id,
      reason: 'Manager account created',
      metadata: { email: manager.email, role: UserRole.MANAGER },
      requestContext,
    });

    return manager;
  }

  async createStaff(
    data: CreateStaffDto,
    actor: AccountGovernanceActor,
    requestContext: AccountGovernanceRequestContext = {},
  ) {
    this.assertStaffRole(data.role);

    const staff = await this.createAccount({
      ...data,
      status: AccountStatus.VERIFIED,
    });

    await this.recordAccountAudit({
      actor,
      action: 'STAFF_CREATED',
      targetId: staff._id?.toString?.() ?? staff.id,
      reason: 'Staff account created',
      metadata: { email: staff.email, role: data.role },
      requestContext,
    });

    return staff;
  }

  async updateProfile(
    id: string,
    body: UpdateProfileDto,
    file?: Express.Multer.File,
  ) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }

    const updateData: Partial<User> = {};

    if (body.fullName !== undefined) updateData.fullName = body.fullName;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.address !== undefined) updateData.address = body.address;

    if (file) {
      const uploaded = await this.cloudinaryService.uploadImage(file);
      updateData.avatarUrl = uploaded.secure_url;
    }

    return this.userModel.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
  }

  async update(id: string, body: UpdateProfileDto, file?: Express.Multer.File) {
    return this.updateProfile(id, body, file);
  }

  async updateStaff(
    actor: AccountGovernanceActor,
    staffId: string,
    body: UpdateStaffDto,
    requestContext: AccountGovernanceRequestContext = {},
  ) {
    const staff = await this.userModel.findById(staffId);
    if (!staff) throw new NotFoundException('Staff account not found');

    this.assertActorCanManageTargetStaff(actor, staff.role);

    if (body.role !== undefined) {
      this.assertStaffRole(body.role);
    }

    const updateData: Partial<User> = {};
    if (body.fullName !== undefined) updateData.fullName = body.fullName;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.role !== undefined) updateData.role = body.role;

    const updatedStaff = await this.userModel.findByIdAndUpdate(
      staffId,
      updateData,
      {
        new: true,
        runValidators: true,
      },
    );

    await this.recordAccountAudit({
      actor,
      action: 'STAFF_UPDATED',
      targetId: staffId,
      reason: 'Staff account updated',
      metadata: {
        previousRole: staff.role,
        nextRole: body.role ?? staff.role,
        fields: Object.keys(updateData),
      },
      requestContext,
    });

    return updatedStaff;
  }

  async updateStatus(userId: string, status: AccountStatus) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    user.status = status;
    await user.save();
  }

  async governAccountStatus(
    actor: AccountGovernanceActor,
    userId: string,
    status: AccountStatus,
    dto: AccountActionDto,
    requestContext: AccountGovernanceRequestContext = {},
  ) {
    const reason = this.requireReason(dto?.reason);
    const target = await this.userModel.findById(userId);
    if (!target) throw new NotFoundException('User not found');

    const governanceMode = this.assertActorCanGovernAccount(actor, target.role);

    target.status = status;
    await target.save();

    const action = this.resolveStatusAuditAction(
      governanceMode,
      status,
      target.role,
    );

    await this.recordAccountAudit({
      actor,
      action,
      targetId: userId,
      reason,
      metadata: { status, targetRole: target.role },
      requestContext,
    });

    return target;
  }

  async updatePassword(userId: string, hashedPassword: string) {
    return this.userModel.findByIdAndUpdate(userId, {
      password: hashedPassword,
    });
  }

  findAll(params: {
    page: number;
    limit: number;
    search?: string;
    sortBy?: string;
    fields?: string;
  }) {
    return this.findByRoles(ACCOUNT_GOVERNANCE_LIST_ROLES, params);
  }

  findStaff(params: {
    page: number;
    limit: number;
    search?: string;
    sortBy?: string;
    fields?: string;
  }) {
    return this.findByRoles(STAFF_ROLE_VALUES, params);
  }

  private async findByRoles(
    roles: readonly UserRole[],
    {
      page,
      limit,
      search,
      sortBy,
      fields,
    }: {
      page: number;
      limit: number;
      search?: string;
      sortBy?: string;
      fields?: string;
    },
  ) {
    const skip = (page - 1) * limit;
    const filter: any = { role: { $in: [...roles] } };

    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: 'i' } },
        { fullName: { $regex: search, $options: 'i' } },
      ];
    }

    let mongooseQuery: Query<User[], User> = this.userModel.find(filter);

    if (sortBy) {
      const sortFields = sortBy
        .split(',')
        .map((f) => (f.startsWith('-') ? [f.slice(1), -1] : [f, 1]));
      mongooseQuery = mongooseQuery.sort(Object.fromEntries(sortFields));
    }

    if (fields) {
      mongooseQuery = mongooseQuery.select(fields.split(',').join(' '));
    } else {
      mongooseQuery = mongooseQuery.select('-password -refreshToken');
    }

    const [data, total] = await Promise.all([
      mongooseQuery.skip(skip).limit(limit).exec(),
      this.userModel.countDocuments(filter),
    ]);

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data,
    };
  }

  findByEmail(email: string) {
    return this.userModel.findOne({ email });
  }

  async findOne(userId: string, actor: OwnershipActor | null = null) {
    const user = await this.userModel.findById(userId);

    if (user && actor !== null) {
      assertOwnerOrPermission({
        actor,
        ownerId: userId,
        permission: Permission.ACCOUNT_USER_GOVERN,
        targetType: 'user',
      });
    }

    return user;
  }

  getMe(userId: string) {
    return this.userModel.findById(userId).select('-password -refreshToken');
  }

  async remove(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.userModel.findByIdAndDelete(userId);
  }

  async governAccountDeletion(
    actor: AccountGovernanceActor,
    userId: string,
    dto: AccountActionDto,
    requestContext: AccountGovernanceRequestContext = {},
  ) {
    const reason = this.requireReason(dto?.reason);
    const target = await this.userModel.findById(userId);
    if (!target) throw new NotFoundException('User not found');

    this.assertActorCanGovernAccount(actor, target.role);

    const deletedUser = await this.userModel.findByIdAndDelete(userId);

    await this.recordAccountAudit({
      actor,
      action: 'ACCOUNT_DELETED',
      targetId: userId,
      reason,
      metadata: { targetRole: target.role, email: target.email },
      requestContext,
    });

    return deletedUser;
  }

  updateRefreshToken(userId: string, refreshToken: string | null) {
    return this.userModel.findByIdAndUpdate(userId, { refreshToken });
  }

  getNewCustomersCount(startDate: Date, endDate: Date): Promise<number> {
    return this.userModel.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate },
    });
  }

  async getNewCustomersDecline(
    currentStart: Date,
    currentEnd: Date,
    previousStart: Date,
    previousEnd: Date,
  ): Promise<number> {
    const currentCount = await this.getNewCustomersCount(
      currentStart,
      currentEnd,
    );
    const previousCount = await this.getNewCustomersCount(
      previousStart,
      previousEnd,
    );

    if (previousCount === 0) return currentCount > 0 ? 1 : 0;

    return (currentCount - previousCount) / previousCount;
  }

  private async createAccount(data: CreateUserDto) {
    let hashedPassword: string | undefined;

    if (data.password) {
      hashedPassword = await hash(data.password);
    }

    const createdUser = new this.userModel({
      ...data,
      ...(hashedPassword && { password: hashedPassword }),
    });

    const user = await createdUser.save();
    const { password, ...safeUser } = user.toObject();
    return safeUser;
  }

  private assertStaffRole(role: UserRole): asserts role is AssignableStaffRole {
    if (!STAFF_ROLE_VALUES.includes(role)) {
      throw new ForbiddenException('Managers can only govern staff roles');
    }
  }

  private assertActorCanManageTargetStaff(
    actor: AccountGovernanceActor,
    targetRole: UserRole,
  ) {
    if (!roleHasPermission(actor.role as UserRole, Permission.STAFF_MANAGE)) {
      throw new ForbiddenException('Staff governance permission required');
    }

    this.assertStaffRole(targetRole);
  }

  private assertActorCanGovernAccount(
    actor: AccountGovernanceActor,
    targetRole: UserRole,
  ): 'admin' | 'staff' {
    if (roleHasPermission(actor.role as UserRole, Permission.ACCOUNT_USER_GOVERN)) {
      return 'admin';
    }

    if (roleHasPermission(actor.role as UserRole, Permission.STAFF_MANAGE)) {
      this.assertStaffRole(targetRole);
      return 'staff';
    }

    throw new ForbiddenException('Account governance permission required');
  }

  private resolveStatusAuditAction(
    governanceMode: 'admin' | 'staff',
    status: AccountStatus,
    targetRole: UserRole,
  ) {
    if (governanceMode === 'staff' && status === AccountStatus.BANNED) {
      return 'STAFF_DEACTIVATED';
    }

    if (status === AccountStatus.BANNED) {
      return 'ACCOUNT_BANNED';
    }

    return this.isStaffRole(targetRole) ? 'STAFF_UPDATED' : 'ACCOUNT_STATUS_UPDATED';
  }

  private isStaffRole(role: UserRole) {
    return STAFF_ROLE_VALUES.includes(role);
  }

  private requireReason(reason?: string) {
    const trimmedReason = reason?.trim();
    if (!trimmedReason) {
      throw new BadRequestException('Account governance actions require a reason');
    }

    return trimmedReason;
  }

  private recordAccountAudit({
    actor,
    action,
    targetId,
    reason,
    metadata,
    requestContext,
  }: {
    actor: AccountGovernanceActor;
    action: string;
    targetId?: string;
    reason: string;
    metadata?: Record<string, any>;
    requestContext: AccountGovernanceRequestContext;
  }) {
    return this.auditService.record({
      actorId: String(actor?.id ?? actor?._id ?? ''),
      actorRole: actor?.role,
      action,
      targetType: 'user',
      targetId,
      reason,
      metadata,
      ip: requestContext.ip,
      userAgent: requestContext.userAgent,
    });
  }
}
