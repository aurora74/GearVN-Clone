import { hash } from 'argon2';
import { Model, Query } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Injectable, NotFoundException } from '@nestjs/common';

import { User, UserDocument } from './user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

import { UserRole } from 'src/auth/enums/user-role.enum';
import { AccountStatus } from 'src/auth/enums/account-status.enum';

@Injectable()
export class UserService {
  constructor(
    private cloudinaryService: CloudinaryService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async create(data: CreateUserDto) {
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

  async update(id: string, body: any, file?: Express.Multer.File) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }

    let avatarUrl = user.avatarUrl;
    if (file) {
      const uploaded = await this.cloudinaryService.uploadImage(file);
      avatarUrl = uploaded.secure_url;
    }

    const updateData = {
      ...body,
      avatarUrl,
    };

    delete updateData.avatar;

    const updatedUser = await this.userModel.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    return updatedUser;
  }

  async updateStatus(userId: string, status: AccountStatus) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    user.status = status;
    await user.save();
  }

  async updatePassword(userId: string, hashedPassword: string) {
    return this.userModel.findByIdAndUpdate(userId, {
      password: hashedPassword,
    });
  }

  async findAll({
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
  }) {
    const skip = (page - 1) * limit;
    const filter: any = { role: UserRole.CUSTOMER };

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
      mongooseQuery = mongooseQuery.select('-password -role -refreshToken');
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

  findOne(userId: string) {
    return this.userModel.findById(userId);
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
}
