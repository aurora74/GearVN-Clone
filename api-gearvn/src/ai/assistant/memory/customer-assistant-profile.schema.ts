import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class CustomerAssistantProfile {
  @Prop({ required: true, trim: true })
  customerId: string;

  @Prop({ type: [String], default: [] })
  preferences: string[];

  @Prop({ type: String, default: '' })
  budgetRange: string;

  @Prop({ type: [String], default: [] })
  brandPreferences: string[];

  @Prop({ type: [String], default: [] })
  useCases: string[];

  @Prop({ type: Object, default: {} })
  specPreferences: Record<string, unknown>;

  @Prop({ type: [String], default: [] })
  productsOfInterest: string[];

  @Prop({ type: String, default: '' })
  name: string;

  @Prop({ type: String, default: '' })
  phone: string;

  @Prop({ type: String, default: '' })
  address: string;

  @Prop({ type: Date, default: null })
  lastExtractedAt: Date | null;

  updatedAt?: Date;
}

export const CustomerAssistantProfileSchema =
  SchemaFactory.createForClass(CustomerAssistantProfile);

CustomerAssistantProfileSchema.index({ customerId: 1 }, { unique: true });

export type CustomerAssistantProfileDocument = CustomerAssistantProfile &
  Document<Types.ObjectId>;
