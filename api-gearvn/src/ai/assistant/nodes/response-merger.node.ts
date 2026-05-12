import { ResponseMergerService } from '../response/response-merger.service';
import {
  ShoppingAssistantStateType,
  ShoppingAssistantStateUpdate,
} from '../shopping-assistant.state';

type ResponseMergerConfig = {
  configurable?: {
    responseMergerService?: ResponseMergerService;
    responseMergeModel?: {
      invoke(
        messages: Array<{ role: string; content: string }>,
        options?: { signal?: AbortSignal },
      ): Promise<unknown>;
    };
    abortSignal?: AbortSignal;
    [key: string]: unknown;
  };
};

export async function responseMergerNode(
  state: ShoppingAssistantStateType,
  config?: ResponseMergerConfig,
): Promise<ShoppingAssistantStateUpdate> {
  const service =
    config?.configurable?.responseMergerService ?? new ResponseMergerService();
  const merged = await service.mergeAssistantResponses(
    {
      responses: state.responses ?? [],
      locale: 'vi-VN',
      traceContext: { roomId: state.roomId },
      signal: config?.configurable?.abortSignal,
    },
    config?.configurable?.responseMergeModel ?? null,
  );

  const responseMergeTrace = merged.trace;
  const {
    responseCount,
    selectedResponseIds,
    droppedDuplicateResponseIds,
    modelName,
  } = responseMergeTrace;
  const stateActionDrafts = state.actionDrafts ?? [];
  const actionDrafts = Array.isArray(merged.metadata.actionDrafts)
    ? merged.metadata.actionDrafts
    : stateActionDrafts.length
      ? stateActionDrafts
      : undefined;
  const toolCalls = mergeToolCalls(merged.metadata.tool_calls, state.toolResults);
  return {
    status: state.status ?? 'completed',
    text: merged.text || state.text || '',
    metadata: {
      ...(state.metadata ?? {}),
      ...merged.metadata,
      response_merge: {
        ...responseMergeTrace,
        responseCount,
        selectedResponseIds,
        droppedDuplicateResponseIds,
        modelName,
      },
      tool_calls: toolCalls,
      ...(actionDrafts ? { actionDrafts } : {}),
      active_subgraph:
        responseMergeTrace.sourceSubgraphs[0] ?? state.activeSubgraph,
      supervisor_decision: state.metadata?.supervisor_decision,
      guardrail_decision: state.metadata?.guardrail_decision,
      model_name: modelName ?? state.metadata?.model_name,
      ...(state.supervisorDecision?.fallbackReason
        ? { fallback_reason: state.supervisorDecision.fallbackReason }
        : {}),
    },
    responseMerge: responseMergeTrace,
    traceEvents: [merged.traceEvent],
    routeTrace: ['merge_response'],
  };
}

function mergeToolCalls(...sources: unknown[]) {
  const merged: unknown[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    for (const call of source) {
      const key = toolCallKey(call);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(call);
    }
  }
  return merged;
}

function toolCallKey(call: unknown): string {
  return stableSerialize(call);
}

function stableSerialize(value: unknown): string {
  if (!value || typeof value !== 'object') return JSON.stringify(value) ?? String(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`)
    .join(',')}}`;
}
