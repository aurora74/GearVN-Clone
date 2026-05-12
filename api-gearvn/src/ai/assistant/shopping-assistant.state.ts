import { Annotation } from '@langchain/langgraph';
import {
  AssistantActionDraft,
  AssistantCheckoutReviewCard,
  AssistantGuardrailDecision,
  AssistantIntent,
  AssistantMemoryReference,
  AssistantMode,
  AssistantRecommendationLedgerEntry,
  AssistantResponseMergeTrace,
  AssistantSubgraphName,
  AssistantToolCallTrace,
  AssistantTraceMetadata,
  SupervisorDecision,
} from './assistant.types';

export type AssistantResponse = {
  intent?: AssistantIntent | string;
  nodeName?: string;
  text: string;
  metadata?: Record<string, unknown>;
};

export type ShoppingAssistantGraphState = {
  mode?: AssistantMode;
  status?: string;
  roomId: string;
  customerId?: string;
  authenticatedUserId?: string | null;
  userText: string;
  attachments?: unknown[];
  promptContext?: Record<string, unknown>;
  primaryIntent?: AssistantIntent;
  intents: AssistantIntent[];
  parsedEntities?: Record<string, unknown>;
  intentPlan?: Record<string, unknown>;
  supervisorDecision?: SupervisorDecision;
  activeSubgraph?: AssistantSubgraphName;
  executionMode?: 'single' | 'parallel' | 'sequential';
  orderedIntents: AssistantIntent[];
  routeIndex: number;
  routeTrace: string[];
  toolResults: AssistantToolCallTrace[];
  memoryReferences: AssistantMemoryReference[];
  guardrailDecisions: AssistantGuardrailDecision[];
  checkoutReview?: AssistantCheckoutReviewCard | null;
  responseMerge?: AssistantResponseMergeTrace | null;
  lastRecommendationLedger: AssistantRecommendationLedgerEntry[];
  responses: AssistantResponse[];
  actionDrafts: AssistantActionDraft[];
  text?: string;
  metadata?: Record<string, unknown>;
  errors: string[];
  traceEvents: AssistantTraceMetadata[];
};

export const ShoppingAssistantState = Annotation.Root({
  mode: Annotation<AssistantMode | undefined>,
  status: Annotation<string | undefined>,
  roomId: Annotation<string>,
  customerId: Annotation<string | undefined>,
  authenticatedUserId: Annotation<string | null | undefined>,
  userText: Annotation<string>,
  attachments: Annotation<unknown[] | undefined>,
  promptContext: Annotation<Record<string, unknown> | undefined>,
  primaryIntent: Annotation<AssistantIntent | undefined>,
  intents: Annotation<AssistantIntent[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  parsedEntities: Annotation<Record<string, unknown> | undefined>,
  intentPlan: Annotation<Record<string, unknown> | undefined>,
  supervisorDecision: Annotation<SupervisorDecision | undefined>({
    reducer: (_left, right) => right,
  }),
  activeSubgraph: Annotation<AssistantSubgraphName | undefined>({
    reducer: (_left, right) => right,
  }),
  executionMode: Annotation<'single' | 'parallel' | 'sequential' | undefined>,
  orderedIntents: Annotation<AssistantIntent[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  routeIndex: Annotation<number>({
    reducer: (_left, right) => right,
    default: () => 0,
  }),
  routeTrace: Annotation<string[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  toolResults: Annotation<AssistantToolCallTrace[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  memoryReferences: Annotation<AssistantMemoryReference[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  guardrailDecisions: Annotation<AssistantGuardrailDecision[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  checkoutReview: Annotation<AssistantCheckoutReviewCard | null | undefined>({
    reducer: (_left, right) => right,
  }),
  responseMerge: Annotation<AssistantResponseMergeTrace | null | undefined>({
    reducer: (_left, right) => right,
  }),
  lastRecommendationLedger: Annotation<AssistantRecommendationLedgerEntry[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  responses: Annotation<AssistantResponse[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  actionDrafts: Annotation<AssistantActionDraft[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  text: Annotation<string | undefined>,
  metadata: Annotation<Record<string, unknown> | undefined>,
  errors: Annotation<string[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  traceEvents: Annotation<AssistantTraceMetadata[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
});

export type ShoppingAssistantStateType = typeof ShoppingAssistantState.State;
export type ShoppingAssistantStateUpdate = typeof ShoppingAssistantState.Update;
