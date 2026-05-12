import { END, START, StateGraph } from '@langchain/langgraph';

import { AssistantIntent } from '../assistant.types';
import {
  AssistantResponse,
  ShoppingAssistantState,
  ShoppingAssistantStateType,
  ShoppingAssistantStateUpdate,
} from '../shopping-assistant.state';
import {
  AssistantNodeResponse,
  mergeAssistantResponses,
} from '../nodes/merge-response.node';
import { staffHandoffNode } from '../nodes/staff-handoff.node';
import { unsupportedNode } from '../nodes/unsupported.node';

type GeneralConfig = {
  configurable?: {
    handlers?: {
      staffHandoff?: (state: ShoppingAssistantStateType) => Promise<any>;
      unsupported?: (state: ShoppingAssistantStateType) => Promise<any>;
    };
    handoffAdapter?: any;
    staffHandoffSummaryService?: any;
  };
};

async function generalStaffHandoffNode(
  state: ShoppingAssistantStateType,
  config?: GeneralConfig,
): Promise<ShoppingAssistantStateUpdate> {
  const result =
    (await config?.configurable?.handlers?.staffHandoff?.(state)) ??
    (await staffHandoffNode(
      {
        ...state,
        customerId: state.customerId ?? state.authenticatedUserId ?? '',
        latestMessage: state.userText,
        intent: AssistantIntent.STAFF_HANDOFF,
        memory: state.promptContext,
      },
      config?.configurable?.handoffAdapter,
      config?.configurable?.staffHandoffSummaryService,
    ));
  return responseUpdate(
    'staff_handoff',
    result,
    state,
    AssistantIntent.STAFF_HANDOFF,
  );
}

async function generalUnsupportedNode(
  state: ShoppingAssistantStateType,
  config?: GeneralConfig,
): Promise<ShoppingAssistantStateUpdate> {
  const result =
    (await config?.configurable?.handlers?.unsupported?.(state)) ??
    unsupportedNode(state);
  return responseUpdate('unsupported', result, state, AssistantIntent.UNSUPPORTED);
}

function routeGeneral(
  state: ShoppingAssistantStateType,
): 'staff_handoff' | 'unsupported' {
  return state.intents?.includes(AssistantIntent.STAFF_HANDOFF)
    ? 'staff_handoff'
    : 'unsupported';
}

function responseUpdate(
  nodeName: string,
  result: any,
  state: ShoppingAssistantStateType,
  fallbackIntent: AssistantIntent,
): ShoppingAssistantStateUpdate {
  const response = normalizeResponse(nodeName, result, fallbackIntent);
  return {
    responses: [response],
    actionDrafts: extractActionDrafts(result),
    routeTrace: [nodeName],
    traceEvents: [
      {
        roomId: state.roomId,
        node: nodeName,
        intent: response.intent as AssistantIntent,
        active_subgraph: 'general',
      },
    ],
  };
}

function normalizeResponse(
  nodeName: string,
  result: any,
  fallbackIntent: AssistantIntent,
): AssistantResponse {
  const response = result as AssistantNodeResponse;
  return {
    intent: response?.intent ?? fallbackIntent,
    nodeName: response?.nodeName ?? nodeName,
    text: response?.text ?? fallbackText(nodeName),
    metadata: response?.metadata ?? result?.metadata ?? {},
  };
}

function fallbackText(nodeName: string): string {
  return nodeName === 'staff_handoff'
    ? 'Minh se chuyen ban sang nhan vien tu van.'
    : '';
}

function extractActionDrafts(result: any) {
  return result?.draft ? [result.draft] : [];
}

function generalMergeNode(
  state: ShoppingAssistantStateType,
): ShoppingAssistantStateUpdate {
  const merged = mergeAssistantResponses(state.responses ?? []);
  return {
    text: merged.text,
    metadata: { ...(state.metadata ?? {}), ...merged.metadata },
  };
}

export const generalSubgraph = new StateGraph(ShoppingAssistantState)
  .addNode('staff_handoff', generalStaffHandoffNode)
  .addNode('unsupported', generalUnsupportedNode)
  .addNode('general_merge', generalMergeNode)
  .addConditionalEdges(START, routeGeneral)
  .addEdge('staff_handoff', 'general_merge')
  .addEdge('unsupported', 'general_merge')
  .addEdge('general_merge', END)
  .compile();
