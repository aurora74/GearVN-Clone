import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { UserRole } from '../auth/enums/user-role.enum';
import { Audit, AuditDocument } from './audit.schema';

export interface AuditRecordInput {
  actorId?: string;
  actorRole?: UserRole;
  action: string;
  targetType: string;
  targetId?: string;
  reason?: string;
  metadata?: Record<string, any>;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(Audit.name)
    private readonly auditModel: Model<AuditDocument>,
  ) {}

  record(input: AuditRecordInput): Promise<AuditDocument> {
    return this.auditModel.create(input);
  }
}
