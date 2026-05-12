import { Injectable } from '@nestjs/common';
import { ChatOpenRouter } from '@langchain/openrouter';

import {
  AssistantIntent,
  AssistantResponseMergeTrace,
  AssistantSubgraphName,
  AssistantTraceMetadata,
} from '../assistant.types';
import { AssistantResponse } from '../shopping-assistant.state';
import { readAssistantModelConfig } from '../config/assistant-model.config';
import {
  ResponseMergePlan,
  ResponseMergePlanJsonSchema,
  ResponseMergePlanSchema,
} from './response-planner.schema';

export type ResponseMergerInput = {
  responses: AssistantResponse[];
  locale?: 'vi-VN' | string;
  traceContext?: Pick<AssistantTraceMetadata, 'roomId' | 'traceId'>;
  signal?: AbortSignal;
};

export type ResponseMergerResult = {
  text: string;
  responses: AssistantResponse[];
  metadata: Record<string, unknown>;
  trace: AssistantResponseMergeTrace & {
    mode:
      | 'single_response_bypass'
      | 'llm_planner_merge'
      | 'deterministic_fallback';
    responseCount: number;
    selectedResponseIds: string[];
    droppedDuplicateResponseIds: string[];
    modelName?: string;
    latencyMs: number;
  };
  traceEvent: AssistantTraceMetadata;
};

type ResponseMergeModel = {
  invoke(
    messages: Array<{ role: string; content: string }>,
    options?: { signal?: AbortSignal },
  ): Promise<unknown>;
};

type MergeableResponse = AssistantResponse & {
  responseId: string;
  text: string;
};

const PRESERVED_METADATA_KEYS = [
  'productCards',
  'reviewSummary',
  'reviewCitations',
  'orderCards',
  'actionDrafts',
  'checkoutReview',
  'handoff',
  'unsupportedReason',
  'memoryReferences',
  'guardrails',
  'active_subgraph',
  'supervisor_decision',
  'tool_calls',
  'guardrail_decision',
  'fallback_reason',
  'retrieval_query',
  'crag_retry',
] as const;

const RESPONSE_MERGE_TIMEOUT_MS = 12_000;
const DETERMINISTIC_FALLBACK_MAX_CHARS = 1800;

@Injectable()
export class ResponseMergerService {
  async mergeAssistantResponses(
    input: ResponseMergerInput,
    modelOverride?: ResponseMergeModel | null,
  ): Promise<ResponseMergerResult> {
    const startedAt = Date.now();
    const responses = normalizeResponses(input.responses);
    const responseCount = responses.length;
    const locale = input.locale ?? 'vi-VN';

    if (responseCount <= 1) {
      const response = responses[0];
      const metadata = response?.metadata ? { ...response.metadata } : {};
      return this.result({
        text: response?.text ?? '',
        responses,
        metadata,
        mode: 'single_response_bypass',
        responseCount,
        selectedResponseIds: response ? [response.responseId] : [],
        droppedDuplicateResponseIds: [],
        modelName: undefined,
        latencyMs: Date.now() - startedAt,
        traceContext: input.traceContext,
      });
    }

    const config = readAssistantModelConfig().openRouter;
    const modelName = config.chatModel;

    try {
      const model = modelOverride ?? createOpenRouterMergeModel();
      if (!model) throw new Error('response_merge_model_unavailable');
      const controller = new AbortController();
      const raw = await withTimeout(
        model.invoke(
          [
            {
              role: 'system',
              content: [
                'You are GearVN response_merge planner.',
                `Write the final customer answer in ${locale} with Vietnamese diacritics.`,
                'Return strict JSON only.',
                'Product facts, prices, stock, order status, payment status, totals, voucher status, and action drafts must be copied only from structured tool results.',
                'Do not invent commerce facts. Do not rewrite structured metadata.',
              ].join(' '),
            },
            {
              role: 'user',
              content: JSON.stringify({
                responses: responses.map((response) => ({
                  responseId: response.responseId,
                  intent: response.intent,
                  nodeName: response.nodeName,
                  text: response.text,
                  structuredMetadataKeys: Object.keys(response.metadata ?? {}),
                })),
              }),
            },
          ],
          { signal: combineAbortSignals(input.signal, controller.signal) },
        ),
        RESPONSE_MERGE_TIMEOUT_MS,
        () => controller.abort(),
      );
      const plan = parseMergePlan(raw);
      const selected = selectResponses(responses, plan.selectedResponseIds);
      const metadata = preserveMetadata(responses);
      return this.result({
        text: plan.finalMessage,
        responses: selected,
        traceResponses: responses,
        metadata,
        mode: 'llm_planner_merge',
        responseCount,
        selectedResponseIds: selected.map((response) => response.responseId),
        droppedDuplicateResponseIds: plan.droppedDuplicateResponseIds,
        modelName,
        latencyMs: Date.now() - startedAt,
        traceContext: input.traceContext,
        factSources: plan.factSources,
      });
    } catch {
      const metadata = preserveMetadata(responses);
      return this.result({
        text: deterministicFallbackText(responses),
        responses,
        metadata,
        mode: 'deterministic_fallback',
        responseCount,
        selectedResponseIds: responses.map((response) => response.responseId),
        droppedDuplicateResponseIds: [],
        modelName,
        latencyMs: Date.now() - startedAt,
        traceContext: input.traceContext,
      });
    }
  }

  private result(input: {
    text: string;
    responses: AssistantResponse[];
    traceResponses?: AssistantResponse[];
    metadata: Record<string, unknown>;
    mode: ResponseMergerResult['trace']['mode'];
    responseCount: number;
    selectedResponseIds: string[];
    droppedDuplicateResponseIds: string[];
    modelName?: string;
    latencyMs: number;
    traceContext?: Pick<AssistantTraceMetadata, 'roomId' | 'traceId'>;
    factSources?: string[];
  }): ResponseMergerResult {
    const sourceSubgraphs = sourceSubgraphsFromResponses(
      input.traceResponses ?? input.responses,
    );
    const preservedMetadata = Object.keys(input.metadata);
    const trace = {
      strategy:
        input.mode === 'single_response_bypass'
          ? 'single'
          : input.mode === 'llm_planner_merge'
            ? 'merge'
            : 'fallback',
      sourceSubgraphs,
      preservedMetadata,
      reason: input.mode,
      mode: input.mode,
      responseCount: input.responseCount,
      selectedResponseIds: input.selectedResponseIds,
      droppedDuplicateResponseIds: input.droppedDuplicateResponseIds,
      modelName: input.modelName,
      latencyMs: input.latencyMs,
    } satisfies ResponseMergerResult['trace'];

    return {
      text: input.text,
      responses: input.responses,
      metadata: {
        ...input.metadata,
        response_merge: trace,
        ...(input.factSources?.length
          ? { response_merge_fact_sources: input.factSources }
          : {}),
      },
      trace,
      traceEvent: {
        ...input.traceContext,
        node: 'response_merge',
        response_merge: trace,
        model_name: input.modelName,
        latency_ms: input.latencyMs,
      },
    };
  }
}

function normalizeResponses(
  responses: AssistantResponse[],
): MergeableResponse[] {
  return responses
    .map((response, index) => ({
      ...response,
      responseId:
        response.nodeName ?? `${response.intent ?? 'response'}-${index}`,
      text: response.text?.trim() ?? '',
    }))
    .filter((response) => response.text.length > 0);
}

function deterministicFallbackText(responses: MergeableResponse[]): string {
  const text = orderResponsesForFallback(responses)
    .map((response) => response.text)
    .filter(Boolean)
    .join('\n\n');
  return trimFallbackText(text, DETERMINISTIC_FALLBACK_MAX_CHARS);
}

function orderResponsesForFallback(
  responses: MergeableResponse[],
): MergeableResponse[] {
  return [...responses].sort(
    (left, right) => intentPriority(left.intent) - intentPriority(right.intent),
  );
}

function intentPriority(intent: unknown): number {
  const order = [
    AssistantIntent.CART_ACTION,
    AssistantIntent.CHECKOUT_PREP,
    AssistantIntent.ORDER_LOOKUP,
    AssistantIntent.PRODUCT_ADVICE,
    AssistantIntent.REVIEW_SUMMARY,
    AssistantIntent.STAFF_HANDOFF,
    AssistantIntent.UNSUPPORTED,
  ];
  const index = order.indexOf(intent as AssistantIntent);
  return index === -1 ? order.length : index;
}

function trimFallbackText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const candidate = text.slice(0, maxChars);
  const sentenceEnd = Math.max(
    candidate.lastIndexOf('.'),
    candidate.lastIndexOf('!'),
    candidate.lastIndexOf('?'),
    candidate.lastIndexOf('\n'),
  );
  if (sentenceEnd > 160) return candidate.slice(0, sentenceEnd + 1).trim();

  const wordEnd = candidate.lastIndexOf(' ');
  const boundary = wordEnd > 160 ? wordEnd : candidate.length;
  return `${candidate.slice(0, boundary).trim()}...`;
}

function parseMergePlan(raw: unknown): ResponseMergePlan {
  const content = (raw as any)?.content ?? raw;
  const candidate =
    typeof content === 'string'
      ? tryParseJson(content)
      : content && typeof content === 'object'
        ? content
        : null;
  const parsed = ResponseMergePlanSchema.safeParse(candidate);
  if (!parsed.success)
    throw new Error('Response merge plan failed schema validation');
  return parsed.data;
}

function selectResponses(
  responses: MergeableResponse[],
  selectedResponseIds: string[],
): MergeableResponse[] {
  if (selectedResponseIds.length === 0) return responses;
  const selected = responses.filter((response) =>
    selectedResponseIds.includes(response.responseId),
  );
  return selected.length > 0 ? selected : responses;
}

function preserveMetadata(
  responses: AssistantResponse[],
): Record<string, unknown> {
  const preserved: Record<string, unknown> = {};
  for (const response of responses) {
    const metadata = response.metadata ?? {};
    for (const key of PRESERVED_METADATA_KEYS) {
      if (metadata[key] === undefined) continue;
      preserved[key] = mergeMetadataValue(preserved[key], metadata[key]);
    }
  }
  return preserved;
}

function mergeMetadataValue(left: unknown, right: unknown) {
  if (Array.isArray(left) && Array.isArray(right)) return left.concat(right);
  if (left && right && isRecord(left) && isRecord(right))
    return { ...left, ...right };
  return right;
}

function sourceSubgraphsFromResponses(
  responses: AssistantResponse[],
): AssistantSubgraphName[] {
  const subgraphs = responses
    .map((response) => response.metadata?.active_subgraph)
    .filter(
      (subgraph): subgraph is AssistantSubgraphName =>
        subgraph === 'sales' || subgraph === 'order' || subgraph === 'general',
    );
  return [...new Set(subgraphs)];
}

function createOpenRouterMergeModel(): ResponseMergeModel | null {
  const config = readAssistantModelConfig().openRouter;
  const apiKey = config.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  return new (ChatOpenRouter as any)({
    apiKey,
    model: config.chatModel,
    temperature: Math.min(config.temperature, 0.2),
    maxTokens: config.maxTokens,
    provider: config.provider,
    modelKwargs: {
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'gearvn_response_merge_plan',
          strict: true,
          schema: ResponseMergePlanJsonSchema,
        },
      },
    },
  });
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout?: () => void,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      onTimeout?.();
      reject(new Error('response_merge_model_timeout'));
    }, timeoutMs);
  });

  return Promise.race([
    promise.finally(() => {
      if (timeout) clearTimeout(timeout);
    }),
    timeoutPromise,
  ]);
}

function combineAbortSignals(
  ...signals: Array<AbortSignal | undefined>
): AbortSignal | undefined {
  const activeSignals = signals.filter(Boolean) as AbortSignal[];
  if (activeSignals.length <= 1) return activeSignals[0];
  const abortSignal = AbortSignal as typeof AbortSignal & {
    any?: (signals: AbortSignal[]) => AbortSignal;
  };
  return abortSignal.any?.(activeSignals) ?? activeSignals[0];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function tryParseJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}
