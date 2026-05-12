import { createHash } from 'crypto';

import {
  ALLOWED_TRACE_KEYS,
  RedactedAssistantTraceMetadata,
} from '../assistant-trace.service';

export const PHOENIX_OTEL_PACKAGE = '@arizeai/phoenix-otel';

type SpanAttributes = Record<string, string | number | boolean>;
type SpanSink = (
  spanName: string,
  attributes: SpanAttributes,
) => void | Promise<void>;

export type AssistantTracer = {
  enabled: boolean;
  packageName: typeof PHOENIX_OTEL_PACKAGE;
  optionalDependencies: string[];
  requiredDependencies: string[];
  spanSink?: SpanSink;
};

export type AssistantTracerOptions = {
  enabled?: boolean;
  spanSink?: SpanSink;
};

type TraceInput = RedactedAssistantTraceMetadata & Record<string, unknown>;

export function createAssistantTracer(
  options: AssistantTracerOptions = {},
): AssistantTracer {
  const configured =
    options.enabled ??
    Boolean(
      process.env.PHOENIX_COLLECTOR_ENDPOINT ||
        process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    );

  return {
    enabled: configured,
    packageName: PHOENIX_OTEL_PACKAGE,
    optionalDependencies: ['langsmith', 'promptfoo'],
    requiredDependencies: [PHOENIX_OTEL_PACKAGE],
    spanSink: options.spanSink,
  };
}

export async function recordAssistantSpan(
  tracer: AssistantTracer,
  spanName: string,
  metadata: TraceInput,
): Promise<void> {
  if (!tracer.enabled) return;

  const redactedMetadata = keepAllowedMetadata(metadata);
  const attributes = toSpanAttributes(redactedMetadata);

  if (tracer.spanSink) {
    await tracer.spanSink(spanName, attributes);
  }
}

export function toSpanAttributes(metadata: TraceInput): SpanAttributes {
  const attributes: SpanAttributes = {};

  setAttribute(attributes, 'ai.trace_id', metadata.traceId);
  setAttribute(attributes, 'ai.room_id_hash', hashIdentifier(metadata.roomId));
  setAttribute(attributes, 'ai.user_id_hash', hashIdentifier(metadata.userId));
  setAttribute(attributes, 'ai.mode', metadata.mode);
  setAttribute(attributes, 'ai.intent', metadata.intent);
  setAttribute(attributes, 'ai.node', metadata.node);
  setAttribute(attributes, 'ai.node_path', joinList(metadata.nodePath, '>'));
  setAttribute(attributes, 'ai.model', metadata.model);
  setAttribute(attributes, 'ai.latency_ms', metadata.latencyMs);
  setAttribute(attributes, 'ai.token_count', metadata.tokenCount);
  setAttribute(attributes, 'ai.product_ids', joinList(metadata.productIds));
  setAttribute(attributes, 'ai.source_urls', joinList(metadata.sourceUrls));
  setAttribute(attributes, 'ai.action_draft_ids', joinList(metadata.actionDraftIds));
  setAttribute(attributes, 'ai.confirmation_result', metadata.confirmationResult);
  setAttribute(
    attributes,
    'ai.guardrail_decisions',
    joinList(metadata.guardrailDecisions),
  );
  setAttribute(attributes, 'ai.retry_count', metadata.retryCount);
  setAttribute(attributes, 'ai.error_count', metadata.errorCount);
  setAttribute(attributes, 'ai.error_code', metadata.errorCode);

  if (metadata.safety && typeof metadata.safety === 'object') {
    for (const [key, value] of Object.entries(metadata.safety)) {
      if (typeof value === 'boolean') {
        attributes[`ai.safety.${key}`] = value;
      }
    }
  }

  return attributes;
}

function keepAllowedMetadata(metadata: TraceInput): TraceInput {
  return Object.fromEntries(
    ALLOWED_TRACE_KEYS.filter((key) => metadata[key] !== undefined).map((key) => [
      key,
      metadata[key],
    ]),
  ) as TraceInput;
}

function hashIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined;

  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function joinList(value: unknown, separator = ','): string | undefined {
  if (!Array.isArray(value)) return undefined;

  const safeValues = value.filter(
    (item): item is string | number => typeof item === 'string' || typeof item === 'number',
  );

  return safeValues.length ? safeValues.join(separator) : undefined;
}

function setAttribute(
  attributes: SpanAttributes,
  key: string,
  value: unknown,
): void {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    attributes[key] = value;
  }
}
