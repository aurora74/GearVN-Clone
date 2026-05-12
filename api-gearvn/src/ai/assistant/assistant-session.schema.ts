import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  AssistantActionDraft,
  AssistantHotMessage,
  AssistantMode,
  AssistantProgressiveSummary,
  AssistantRecommendationLedgerEntry,
  AssistantStaffSummary,
} from './assistant.types';

const defaultProgressiveSummary = (): AssistantProgressiveSummary => ({
  shoppingNeed: '',
  budget: '',
  constraintsAndSpecs: [],
  productsDiscussed: [],
  cartCheckoutContext: '',
  orderContext: '',
  unresolvedQuestions: [],
});

@Schema({ timestamps: true })
export class AssistantSession {
  @Prop({ required: true, trim: true })
  roomId: string;

  @Prop({ required: true, trim: true })
  threadId: string;
  @Prop({ type: String, enum: ['ai', 'staff'], default: 'ai' })
  mode: AssistantMode;

  @Prop({ type: [Object], default: [] })
  hotMessages: AssistantHotMessage[];

  @Prop({ type: Object, default: defaultProgressiveSummary })
  progressiveSummary: AssistantProgressiveSummary;

  @Prop({ type: [Object], default: [] })
  pendingActionDrafts: AssistantActionDraft[];

  @Prop({ type: Object, default: null })
  staffSummary: AssistantStaffSummary | null;

  @Prop({ type: [Object], default: [] })
  lastRecommendationLedger: AssistantRecommendationLedgerEntry[];

  @Prop({ type: Date, default: null })
  lastSummaryAt: Date | null;

  @Prop({ type: Date, default: Date.now })
  lastActiveAt: Date;
}

export const AssistantSessionSchema =
  SchemaFactory.createForClass(AssistantSession);

AssistantSessionSchema.index({ roomId: 1 }, { unique: true });

export type AssistantSessionDocument = AssistantSession & Document<Types.ObjectId>;
