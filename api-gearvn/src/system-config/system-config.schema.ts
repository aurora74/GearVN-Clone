import { Document } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type SystemConfigDocument = SystemConfig & Document;

@Schema({ timestamps: true })
export class SystemConfig {
  @Prop({ required: true, unique: true, trim: true })
  key: string;

  @Prop({ type: Object, required: true })
  value: any;

  @Prop()
  description?: string;
}

export const SystemConfigSchema = SchemaFactory.createForClass(SystemConfig);
