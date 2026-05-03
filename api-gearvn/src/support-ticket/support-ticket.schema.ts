import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

import { SUPPORT_TICKET_SOURCE, SUPPORT_TICKET_STATUS } from '../config.global';

export type SupportTicketDocument = SupportTicket & Document<Types.ObjectId>;
export type SupportTicketStatus =
  (typeof SUPPORT_TICKET_STATUS)[keyof typeof SUPPORT_TICKET_STATUS];
export type SupportTicketSource =
  (typeof SUPPORT_TICKET_SOURCE)[keyof typeof SUPPORT_TICKET_SOURCE];

@Schema({ timestamps: true })
export class SupportTicket {
  @Prop({ required: true, unique: true })
  ticketCode: string;

  @Prop({ required: true, enum: Object.values(SUPPORT_TICKET_SOURCE), index: true })
  sourceType: SupportTicketSource;

  @Prop({ index: true })
  sourceId?: string;

  @Prop({ index: true })
  roomId?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  customerId?: string;

  @Prop({ required: true })
  contextLabel: string;

  @Prop({
    required: true,
    enum: Object.values(SUPPORT_TICKET_STATUS),
    default: SUPPORT_TICKET_STATUS.NEW,
    index: true,
  })
  status: SupportTicketStatus;

  @Prop({ type: Date, default: Date.now, index: true })
  latestActivityAt: Date;

  @Prop({ type: Date })
  resolvedAt?: Date | null;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;
}

export const SupportTicketSchema = SchemaFactory.createForClass(SupportTicket);
SupportTicketSchema.index(
  { sourceType: 1, sourceId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sourceType: SUPPORT_TICKET_SOURCE.PRODUCT_QNA,
      sourceId: { $type: 'string' },
    },
  },
);
SupportTicketSchema.index({ status: 1, latestActivityAt: -1 });
