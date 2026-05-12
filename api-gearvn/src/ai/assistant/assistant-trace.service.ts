import { Injectable } from '@nestjs/common';
import { AssistantTraceMetadata } from './assistant.types';

export const ALLOWED_TRACE_KEYS = [
  'traceId',
  'roomId',
  'userId',
  'node',
  'intent',
  'mode',
  'nodePath',
  'latencyMs',
  'tokenCount',
  'model',
  'productIds',
  'sourceUrls',
  'actionDraftIds',
  'confirmationResult',
  'guardrailDecisions',
  'retryCount',
  'errorCount',
  'errorCode',
  'safety',
  'supervisor_decision',
  'active_subgraph',
  'tool_calls',
  'retrieval_query',
  'crag_retry',
  'memory_used',
  'response_merge',
  'guardrail_decision',
  'model_name',
  'latency_ms',
  'fallback_reason',
  'supervisor_latency_ms',
  'resolver_latency_ms',
  'catalog_detail_latency_ms',
  'web_review_latency_ms',
  'memory_extraction_latency_ms',
  'retrieval_latency_ms',
  'response_composition_latency_ms',
  'memory_extraction_scheduled',
  'memory_extraction_mode',
  'deterministic_bypass',
  'bypass_confidence',
  'product_context_resolver',
] as const;

type AllowedTraceKey = (typeof ALLOWED_TRACE_KEYS)[number];

export type RedactedAssistantTraceMetadata = Partial<
  Pick<AssistantTraceMetadata, AllowedTraceKey>
>;

@Injectable()
export class AssistantTraceService {
  redactTraceMetadata(
    metadata: AssistantTraceMetadata,
  ): RedactedAssistantTraceMetadata {
    const redacted: RedactedAssistantTraceMetadata = {};

    for (const key of ALLOWED_TRACE_KEYS) {
      if (metadata[key] !== undefined) {
        redacted[key] = metadata[key] as never;
      }
    }

    if (metadata.safety) {
      redacted.safety = Object.fromEntries(
        Object.entries(metadata.safety).filter(
          ([, value]) => typeof value === 'boolean',
        ),
      );
    }

    return redacted;
  }
}
