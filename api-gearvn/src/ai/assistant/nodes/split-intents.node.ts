import { AssistantIntent } from '../assistant.types';

export type IntentExecutionMode = 'single' | 'parallel' | 'sequential';

export type SplitIntentsResult = {
  executionMode: IntentExecutionMode;
  orderedIntents: AssistantIntent[];
  parallelizable: boolean;
};

type SplitIntentsState = {
  primaryIntent?: AssistantIntent;
  intents?: AssistantIntent[];
};

const SAFE_PARALLEL_PAIRS = new Set([
  pairKey([AssistantIntent.PRODUCT_ADVICE, AssistantIntent.REVIEW_SUMMARY]),
  pairKey([AssistantIntent.PRODUCT_ADVICE, AssistantIntent.ORDER_LOOKUP]),
]);

const ACTION_STATE_INTENTS = new Set<AssistantIntent>([
  AssistantIntent.CART_ACTION,
  AssistantIntent.CHECKOUT_PREP,
  AssistantIntent.STAFF_HANDOFF,
]);

export function splitIntentsNode(state: SplitIntentsState): SplitIntentsResult {
  const orderedIntents = normalizeIntentOrder(state);
  const parallelizable = isSafeParallelPair(orderedIntents);
  const hasActionState = orderedIntents.some((intent) =>
    ACTION_STATE_INTENTS.has(intent),
  );

  return {
    executionMode:
      orderedIntents.length <= 1
        ? 'single'
        : parallelizable && !hasActionState
          ? 'parallel'
          : 'sequential',
    orderedIntents,
    parallelizable,
  };
}

export function normalizeIntentOrder(state: SplitIntentsState): AssistantIntent[] {
  const intents = state.intents?.length
    ? state.intents
    : state.primaryIntent
      ? [state.primaryIntent]
      : [AssistantIntent.UNSUPPORTED];
  return Array.from(new Set(intents));
}

function isSafeParallelPair(intents: AssistantIntent[]): boolean {
  return intents.length === 2 && SAFE_PARALLEL_PAIRS.has(pairKey(intents));
}

function pairKey(intents: AssistantIntent[]): string {
  return [...intents].sort().join('|');
}
