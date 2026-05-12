import { Injectable } from '@nestjs/common';

import { AssistantMode } from '../assistant.types';
import { AssistantSessionService } from '../assistant-session.service';
import { AssistantHandoffSummary } from '../staff-handoff-summary.service';
import { SupportTicketService } from '../../../support-ticket/support-ticket.service';

type HandoffTicketInput = {
  sourceType?: 'chat' | string;
  roomId: string;
  customerId: string;
  latestMessageId?: string;
  contextLabel?: string;
  metadata?: {
    assistantHandoffSummary?: AssistantHandoffSummary;
    [key: string]: unknown;
  };
};

@Injectable()
export class SupportHandoffAdapter {
  constructor(
    private readonly supportTicketService: SupportTicketService,
    private readonly assistantSessionService: AssistantSessionService,
  ) {}

  async setMode(roomId: string, _options: { mode: 'staff'; aiPaused: true }) {
    await this.assistantSessionService.setMode(roomId, AssistantMode.STAFF);
    return { mode: AssistantMode.STAFF, aiPaused: true };
  }

  async createOrRefreshForChat(input: HandoffTicketInput) {
    return this.supportTicketService.createOrRefreshForChat({
      roomId: input.roomId,
      customerId: input.customerId,
      latestMessageId: input.latestMessageId ?? '',
      contextLabel: input.contextLabel ?? 'Chat khách hàng',
      metadata: input.metadata,
    });
  }

  async appendStaffOnlyMetadata(
    roomId: string,
    metadata: { assistantHandoffSummary: AssistantHandoffSummary },
  ) {
    const summary = metadata.assistantHandoffSummary;
    await this.assistantSessionService.recordStaffSummary(roomId, {
      summaryId: `staff-handoff-${Date.now()}`,
      text: serializeStaffSummary(summary),
      createdAt: new Date(summary.latestHandoffAt),
      assistantHandoffSummary: summary,
    } as any);
  }

  serializeCustomerPayload<T extends { metadata?: Record<string, unknown> }>(
    message: T,
  ): T {
    const { assistantHandoffSummary: _summary, ...metadata } =
      message.metadata ?? {};
    return {
      ...message,
      metadata,
    };
  }
}

function serializeStaffSummary(summary: AssistantHandoffSummary): string {
  return [
    summary.need,
    summary.budget,
    ...summary.constraints,
    ...summary.productsDiscussed.map((product) =>
      typeof product === 'string' ? product : JSON.stringify(product),
    ),
    summary.cartCheckoutContext,
    ...summary.orderContext,
    ...summary.unresolvedQuestions,
    summary.confidence,
    Array.isArray(summary.uncertainty)
      ? summary.uncertainty.join('\n')
      : summary.uncertainty,
  ]
    .filter(Boolean)
    .join('\n');
}
