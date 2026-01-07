import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { AuditService } from '../audit/audit.service';
import { UserRole } from '../auth/enums/user-role.enum';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';
import {
  SystemConfig,
  SystemConfigDocument,
} from './system-config.schema';

export interface SystemConfigActor {
  id?: string;
  _id?: string;
  role?: UserRole;
}

export interface SystemConfigRequestContext {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class SystemConfigService {
  constructor(
    @InjectModel(SystemConfig.name)
    private readonly systemConfigModel: Model<SystemConfigDocument>,
    private readonly auditService: AuditService,
  ) {}

  findAll(): Promise<SystemConfigDocument[]> {
    return this.systemConfigModel.find().sort({ key: 1 }).exec();
  }

  async updateConfig(
    actor: SystemConfigActor,
    key: string,
    dto: UpdateSystemConfigDto,
    requestContext: SystemConfigRequestContext = {},
  ): Promise<SystemConfigDocument> {
    const reason = dto.reason?.trim();

    if (!reason) {
      throw new BadRequestException('System config changes require a reason');
    }

    const updatedConfig = await this.systemConfigModel
      .findOneAndUpdate(
        { key },
        {
          $set: {
            key,
            value: dto.value,
            description: dto.description,
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();

    await this.auditService.record({
      actorId: String(actor?.id ?? actor?._id ?? ''),
      actorRole: actor?.role,
      action: 'SYSTEM_CONFIG_UPDATED',
      targetType: 'system-config',
      targetId: key,
      reason,
      metadata: {
        key,
        value: dto.value,
      },
      ip: requestContext.ip,
      userAgent: requestContext.userAgent,
    });

    return updatedConfig;
  }
}
