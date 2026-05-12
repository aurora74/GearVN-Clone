import { AssistantIntent, AssistantMode } from '../assistant.types';
import {
  AssistantHandoffSummary,
  StaffHandoffSummaryService,
} from '../staff-handoff-summary.service';
import { SupportHandoffAdapter } from '../adapters/support-handoff.adapter';

export { SupportHandoffAdapter } from '../adapters/support-handoff.adapter';
export { StaffHandoffSummaryService } from '../staff-handoff-summary.service';

type StaffHandoffState = {
  roomId: string;
  customerId: string;
  latestMessage?: string;
  latestMessageId?: string;
  intent?: string;
  action?: string;
  actionKind?: string;
  userAction?: string;
  memory?: Record<string, any>;
};

type StaffHandoffResult = any;

const STAFF_HANDOFF_LABEL = 'Chat với nhân viên tư vấn';

export async function staffHandoffNode(
  state: StaffHandoffState,
  adapter: Pick<
    SupportHandoffAdapter,
    | 'setMode'
    | 'createOrRefreshForChat'
    | 'appendStaffOnlyMetadata'
    | 'serializeCustomerPayload'
  >,
  summaryService = new StaffHandoffSummaryService(),
): Promise<StaffHandoffResult> {
  if (!isExplicitStaffHandoff(state)) {
    return {
      type: 'continue_ai',
      mode: AssistantMode.AI,
    };
  }

  const summary = summaryService.build({
    ...(state.memory ?? {}),
    roomId: state.roomId,
    transcriptRoomId: state.roomId,
  });
  const staffMetadata = { assistantHandoffSummary: summary };

  const mode = await adapter.setMode(state.roomId, {
    mode: AssistantMode.STAFF,
    aiPaused: true,
  });
  const ticket = await adapter.createOrRefreshForChat({
    sourceType: 'chat',
    roomId: state.roomId,
    customerId: state.customerId,
    ...(state.latestMessageId ? { latestMessageId: state.latestMessageId } : {}),
    contextLabel: STAFF_HANDOFF_LABEL,
    metadata: staffMetadata,
  });
  await adapter.appendStaffOnlyMetadata(state.roomId, staffMetadata);

  const customerPayload = adapter.serializeCustomerPayload({
    metadata: {
      assistantHandoffSummary: summary,
      publicAction: 'handoff_started',
    },
  });

  return {
    type: 'staff_handoff',
    mode: AssistantMode.STAFF,
    aiPaused: mode.aiPaused,
    ticket,
    staffMetadata,
    customerMessageMetadata: customerPayload.metadata ?? {},
  };
}

function isExplicitStaffHandoff(state: StaffHandoffState): boolean {
  return (
    state.intent === AssistantIntent.STAFF_HANDOFF ||
    state.latestMessage === STAFF_HANDOFF_LABEL ||
    state.action === AssistantIntent.STAFF_HANDOFF ||
    state.actionKind === AssistantIntent.STAFF_HANDOFF ||
    state.userAction === AssistantIntent.STAFF_HANDOFF
  );
}
