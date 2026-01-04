import { Document } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { UserRole } from '../auth/enums/user-role.enum';

export type AuditDocument = Audit & Document;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Audit {
  @Prop()
  actorId?: string;

  @Prop({ type: String, enum: UserRole })
  actorRole?: UserRole;

  @Prop({ required: true })
  action: string;

  @Prop({ required: true })
  targetType: string;

  @Prop()
  targetId?: string;

  @Prop()
  reason?: string;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>;

  @Prop()
  ip?: string;

  @Prop()
  userAgent?: string;

  createdAt: Date;
}

export const AuditSchema = SchemaFactory.createForClass(Audit);
