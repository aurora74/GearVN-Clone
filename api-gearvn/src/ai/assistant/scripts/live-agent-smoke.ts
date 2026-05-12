import { NestFactory } from '@nestjs/core';

import { AppModule } from '../../../app.module';
import { AssistantService } from '../assistant.service';
import { shoppingAssistantEvalFixtures } from '../evals/shopping-assistant.fixtures';
import {
  loadLocalEnv,
  requireEnvPresence,
} from '../../../../scripts/script-env';

type TraceLike = Record<string, unknown>;

type SmokeLine = {
  scenarioId: string;
  prompt: string;
  passed: boolean;
  route: unknown;
  active_subgraph: unknown;
  model_name: unknown;
  tool_calls: unknown;
  crag_retry: unknown;
  memory_used: unknown;
  response_merge: unknown;
  fallback_reason: unknown;
  trace_checks: Record<string, boolean>;
  expected_product_card_count: number | null;
  product_card_count: number | null;
  cart_action: boolean;
  checkout_continuation: boolean;
  error: string | null;
  latency_ms: number | null;
};

const COMMAND_NAME = 'assistant:smoke:live';

const REQUIRED_ENV = [
  'OPENROUTER_API_KEY',
  'OPENROUTER_CHAT_MODEL',
  'QDRANT_URL',
  'QDRANT_API_KEY',
  'MONGO_URI',
] as const;

const PHASE_09_2_SCENARIOS = shoppingAssistantEvalFixtures.filter((fixture) =>
  fixture.id.startsWith('09.2-scenario-'),
);

const LIVE_SMOKE_EXPECTED_TRACE_LABELS: Record<string, readonly string[]> = {
  '09.2-scenario-ai-ml-rank-detail-cart-checkout': [
    'deterministic_bypass',
    'product_context_resolver',
    'product_card_count',
    'memory_extraction_scheduled',
  ],
  '09.2-scenario-lenovo-detail-review-cart-checkout': [
    'product_context_resolver',
    'product_detail',
    'catalog_detail_latency_ms',
    'cart_action',
  ],
  '09.2-scenario-requested-five-count-bounded-cart': [
    'deterministic_bypass',
    'requested_recommendation_limit',
    'product_card_count',
    'memory_extraction_scheduled',
  ],
  '09.2-scenario-explicit-public-source-gating': [
    'product_context_resolver',
    'product_detail',
    'explicit_public_review',
    'review_summary',
    'web_review_latency_ms',
  ],
  '09.2-scenario-ambiguous-family-clarify-before-cart': [
    'product_context_resolver',
    'clarification',
  ],
};

const REQUIRED_TRACE_CHECKS = [
  'product_context_resolver',
  'product_detail',
  'review_summary',
  'memory_extraction_scheduled',
  'deterministic_bypass',
  'requested_recommendation_limit',
  'product_card_count',
  'cart_action',
  'checkout_continuation',
] as const;

const VIETNAMESE_DIACRITIC_PATTERN =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

async function main(): Promise<void> {
  loadLocalEnv();
  const envPresence = requireEnvPresence([...REQUIRED_ENV]);
  const missingEnv = Object.entries(envPresence)
    .filter(([, value]) => !value.present)
    .map(([name]) => name);

  if (missingEnv.length > 0) {
    console.log(
      JSON.stringify({
        assistantLiveSmoke: true,
        command: COMMAND_NAME,
        status: 'skip',
        skip: true,
        reason: 'missing_required_env',
        missingEnv,
        required: envPresence,
        prompts: PHASE_09_2_SCENARIOS.map((scenario) => ({
          scenarioId: scenario.id,
          prompt: scenario.userInput,
          expectedTraceLabels: liveExpectedTraceLabels(scenario),
          expectedProductCardCount: scenario.expectedProductCardCount ?? null,
        })),
        secretKeysLogged: false,
      }),
    );
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  try {
    const assistant = app.get(AssistantService);
    let failed = false;
    const smokeRunId = `phase-09-2-live-smoke-${Date.now()}`;
    const roomId = smokeRunId;
    const authenticatedUserId = `${smokeRunId}-customer`;

    for (const scenario of PHASE_09_2_SCENARIOS) {
      const startedAt = Date.now();
      try {
        const result = await assistant.invokeForChatMessage({
          roomId,
          authenticatedUserId,
          text: scenario.userInput,
        });
        const evidence = traceEvidence(result.metadata);
        const line = smokeLine(
          scenario,
          result.text,
          evidence,
          Date.now() - startedAt,
        );
        failed ||= !line.passed;
        console.log(JSON.stringify(line));
      } catch (error) {
        failed = true;
        console.log(
          JSON.stringify({
            scenarioId: scenario.id,
            prompt: scenario.userInput,
            passed: false,
            route: null,
            active_subgraph: null,
            model_name: null,
            tool_calls: [],
            crag_retry: null,
            memory_used: null,
            response_merge: null,
            fallback_reason: 'live_prompt_failed',
            error: safeErrorMessage(error),
            trace_checks: traceChecksFor(
              {},
              liveExpectedTraceLabels(scenario),
            ),
            expected_product_card_count:
              scenario.expectedProductCardCount ?? null,
            product_card_count: null,
            cart_action: false,
            checkout_continuation: false,
            latency_ms: Date.now() - startedAt,
          } satisfies SmokeLine),
        );
      }
    }

    if (failed) process.exitCode = 1;
  } finally {
    await app.close();
  }
}

function smokeLine(
  scenario: (typeof PHASE_09_2_SCENARIOS)[number],
  text: string,
  evidence: TraceLike,
  fallbackLatencyMs: number,
): SmokeLine {
  const supervisorDecision = asRecord(evidence.supervisor_decision);
  const expectedTraceLabels = liveExpectedTraceLabels(scenario);
  const traceChecks = traceChecksFor(evidence, expectedTraceLabels);
  const productCardCount =
    toNumber(evidence.product_card_count) ??
    productCardsFromMetadata(evidence.metadata);
  const productCardCountMatches =
    scenario.expectedProductCardCount == null ||
    productCardCount === scenario.expectedProductCardCount;
  const line: SmokeLine = {
    scenarioId: scenario.id,
    prompt: scenario.userInput,
    passed:
      Boolean(text) &&
      VIETNAMESE_DIACRITIC_PATTERN.test(text) &&
      expectedTraceLabels.length > 0 &&
      expectedTraceLabels.every((label) => traceChecks[label] === true) &&
      productCardCountMatches,
    route: supervisorDecision?.route ?? evidence.active_subgraph ?? null,
    active_subgraph: evidence.active_subgraph ?? null,
    model_name: evidence.model_name ?? null,
    tool_calls: summarizeToolCalls(evidence.tool_calls),
    crag_retry: evidence.crag_retry ?? null,
    memory_used: evidence.memory_used ?? null,
    response_merge: summarizeResponseMerge(evidence.response_merge),
    fallback_reason: evidence.fallback_reason ?? null,
    trace_checks: traceChecks,
    expected_product_card_count: scenario.expectedProductCardCount ?? null,
    product_card_count: productCardCount,
    cart_action: traceChecks.cart_action,
    checkout_continuation: traceChecks.checkout_continuation,
    error: null,
    latency_ms: toNumber(evidence.latency_ms) ?? fallbackLatencyMs,
  };
  return line;
}

function traceEvidence(metadata: Record<string, unknown>): TraceLike {
  const trace = Array.isArray(metadata.trace)
    ? (metadata.trace as TraceLike[])
    : [];
  return trace.reduce<TraceLike>(
    (merged, event) => {
      for (const [key, value] of Object.entries(event)) {
        if (value !== undefined) merged[key] = value;
      }
      return merged;
    }, 
    { ...metadata, metadata },
  );
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 500);
  return String(error).slice(0, 500);
}

function liveExpectedTraceLabels(
  scenario: (typeof PHASE_09_2_SCENARIOS)[number],
): readonly string[] {
  const labels = [
    ...(scenario.expectedTraceLabels ?? []),
    ...(LIVE_SMOKE_EXPECTED_TRACE_LABELS[scenario.id] ?? []),
  ];
  return Array.from(new Set(labels));
}

function traceChecksFor(
  evidence: TraceLike,
  expectedTraceLabels: readonly string[] = [],
): Record<string, boolean> {
  const labels = new Set([...REQUIRED_TRACE_CHECKS, ...expectedTraceLabels]);
  return Object.fromEntries(
    Array.from(labels, (label) => [label, hasTraceEvidence(evidence, label)]),
  );
}

function hasTraceEvidence(evidence: TraceLike, label: string): boolean {
  if (Object.prototype.hasOwnProperty.call(evidence, label)) {
    return Boolean(evidence[label]);
  }
  const serialized = JSON.stringify(evidence);
  return serialized.includes(label);
}

function summarizeToolCalls(value: unknown): unknown {
  if (!Array.isArray(value)) return [];
  return value.map((toolCall) => {
    const record = asRecord(toolCall);
    return {
      toolName: record?.toolName ?? record?.name ?? null,
      subgraph: record?.subgraph ?? null,
      status: record?.status ?? null,
    };
  });
}

function summarizeResponseMerge(value: unknown): unknown {
  const record = asRecord(value);
  if (!record) return null;
  return {
    strategy: record.strategy ?? null,
    mode: record.mode ?? null,
    responseCount: record.responseCount ?? null,
    selectedResponseIds: record.selectedResponseIds ?? [],
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function productCardsFromMetadata(value: unknown): number | null {
  const metadata = asRecord(value);
  const cards = metadata?.productCards ?? metadata?.product_cards;
  return Array.isArray(cards) ? cards.length : null;
}

main().catch(() => {
  console.error(
    JSON.stringify({
      assistantLiveSmoke: true,
      status: 'failed',
      error: 'live_agent_smoke_failed',
      secretKeysLogged: false,
    }),
  );
  process.exitCode = 1;
});
