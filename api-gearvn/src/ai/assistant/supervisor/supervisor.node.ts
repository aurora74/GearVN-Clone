import { ChatOpenRouter } from '@langchain/openrouter';

import {
  AssistantIntent,
  AssistantMemoryReference,
  AssistantMode,
  AssistantProductCard,
  AssistantRecommendationLedgerEntry,
  AssistantSubgraphName,
  SupervisorDecision,
} from '../assistant.types';
import { readAssistantModelConfig } from '../config/assistant-model.config';
import {
  ShoppingAssistantStateType,
  ShoppingAssistantStateUpdate,
} from '../shopping-assistant.state';
import {
  SupervisorDecisionJsonSchema,
  SupervisorDecisionPayload,
  SupervisorDecisionSchema,
} from './supervisor.schema';
import {
  extractRecommendationReference as extractRankRecommendationReference,
  isOrdinalOnlyReference,
} from '../resolvers/recommendation-reference.util';
import { detectProductFamilyFromText } from '../../retrieval/product-family-taxonomy';
import {
  comboGroupsFromIntentPrimitives,
  detectIntentPrimitives,
} from '../../retrieval/product-intent-primitives';

type SupervisorClassifier = {
  classify(text: string): Promise<unknown>;
};

type SupervisorConfig = {
  configurable?: {
    classifier?: SupervisorClassifier;
    supervisorModel?: {
      invoke(
        messages: Array<{ role: string; content: string }>,
        options?: { signal?: AbortSignal },
      ): Promise<unknown>;
    };
    promptContext?: Record<string, unknown>;
    abortSignal?: AbortSignal;
  };
};

type ConversationContext = {
  contextualUserText?: string;
  productCategory?: string;
  requestedMoreOptions?: boolean;
  reason?: string;
};
const SUPERVISOR_MODEL_TIMEOUT_MS = 12_000;

const AMBIGUOUS_CART_PRODUCT_FAMILY_TERMS = [
  'acer',
  'aorus',
  'asus',
  'cyborg',
  'dell',
  'gigabyte',
  'hp',
  'ideapad',
  'inspiron',
  'katana',
  'legion',
  'lenovo',
  'loq',
  'msi',
  'nitro',
  'omen',
  'predator',
  'rog',
  'tuf',
  'victus',
];
const ROUTE_INTENTS: Record<AssistantSubgraphName, AssistantIntent[]> = {
  sales: [AssistantIntent.PRODUCT_ADVICE, AssistantIntent.REVIEW_SUMMARY],
  order: [
    AssistantIntent.CART_ACTION,
    AssistantIntent.CHECKOUT_PREP,
    AssistantIntent.ORDER_LOOKUP,
  ],
  general: [AssistantIntent.STAFF_HANDOFF, AssistantIntent.UNSUPPORTED],
};

export async function supervisorNode(
  state: ShoppingAssistantStateType,
  config?: SupervisorConfig,
): Promise<ShoppingAssistantStateUpdate> {
  if (state.mode === AssistantMode.STAFF) {
    return { status: 'staff_mode_paused' };
  }

  const openRouterConfig = readAssistantModelConfig().openRouter;
  const modelName = openRouterConfig.chatModel;
  const conversationContext = buildConversationContext(state);
  const supervisorText =
    conversationContext.contextualUserText ?? state.userText ?? '';
  const safeSupervisorText = redactCustomerPii(supervisorText);
  if (isMemoryRecallRequest(supervisorText)) {
    return supervisorUpdate(state, {
      route: 'general',
      confidence: 0.96,
      intents: [AssistantIntent.UNSUPPORTED],
      entities: {},
      memoryRefs: [],
      fallbackReason: 'memory_recall',
      modelName,
    });
  }

  if (isCourtesyOnly(state.userText ?? '')) {
    return supervisorUpdate(state, {
      route: 'general',
      confidence: 0.96,
      intents: [AssistantIntent.UNSUPPORTED],
      entities: {},
      memoryRefs: [],
      fallbackReason: 'courtesy',
      modelName,
    });
  }
  const deterministicBypass = highConfidenceDeterministicBypassDecision(
    supervisorText,
    modelName,
    conversationContext,
  );
  if (deterministicBypass) {
    return supervisorUpdate(state, deterministicBypass);
  }

  const greetingDecision = maybeGreetingSupervisorDecision(state, modelName);

  if (greetingDecision) {
    return supervisorUpdate(state, greetingDecision);
  }

  const hasConfiguredSupervisor =
    Boolean(config?.configurable?.classifier) ||
    Boolean(config?.configurable?.supervisorModel) ||
    openRouterConfig.apiKeyPresent;
  const deterministicDecision = hasConfiguredSupervisor
    ? null
    : deterministicCommerceDecision(
        supervisorText,
        undefined,
        modelName,
        conversationContext,
      );
  if (deterministicDecision) {
    return supervisorUpdate(state, deterministicDecision);
  }

  try {
    const raw = await invokeSupervisorModel(safeSupervisorText, state, config);
    const decision = enrichSupervisorDecision(
      state,
      normalizeSupervisorDecision(raw, modelName),
    );
    return supervisorUpdate(state, decision);
  } catch {
    const decision = heuristicSupervisorDecision(
      state,
      'supervisor_model_failed',
      modelName,
    );
    return supervisorUpdate(state, decision);
  }
}

async function invokeSupervisorModel(
  safeUserText: string,
  state: ShoppingAssistantStateType,
  config?: SupervisorConfig,
) {
  if (config?.configurable?.classifier) {
    return config.configurable.classifier.classify(safeUserText);
  }

  const model =
    config?.configurable?.supervisorModel ?? createOpenRouterSupervisorModel();
  if (!model) return heuristicSupervisorDecision(state);

  const controller = new AbortController();
  const response = await withTimeout(
    model.invoke(
      [
        {
          role: 'system',
          content: [
            'You are the GearVN shopping assistant Supervisor.',
            'Return strict JSON only using route sales, order, or general.',
            'sales handles product advice and public review summary.',
            'Use conversation context, hot messages, and profile memory to resolve terse follow-up answers before routing.',
            'If the user answered a prior shopping question with budget, use case, specs, or priorities, keep the prior product category and route to sales.',
            'Generic product advice like “tư vấn laptop” should set entities.broadNeed=true so the assistant asks follow-up questions before recommending products.',
            'Treat common Vietnamese commerce typos such as “laptp” as “laptop”.',
            'order handles cart drafts, checkout preparation, vouchers, and owned order lookup; requests like “lấy cho mình con <product name>” are CART_ACTION drafts.',
            'general handles greeting, small talk, unsupported scope, and staff handoff.',
            'Do not execute tools, create orders, make payments, reserve vouchers, or override ownership.',
          ].join(' '),
        },
        {
          role: 'user',
          content: formatSupervisorUserContent(safeUserText, state, config),
        },
      ],
      {
        signal: combineAbortSignals(
          config?.configurable?.abortSignal,
          controller.signal,
        ),
      },
    ),
    SUPERVISOR_MODEL_TIMEOUT_MS,
    () => controller.abort(),
  );
  return (response as any)?.content ?? response;
}

function formatSupervisorUserContent(
  safeUserText: string,
  state: ShoppingAssistantStateType,
  config?: SupervisorConfig,
): string {
  const promptContext =
    config?.configurable?.promptContext ?? state.promptContext ?? {};
  const sections = promptContextSections(promptContext);
  const summary = [
    sectionContent(sections, 'profileMemory'),
    sectionContent(sections, 'preferenceNotes'),
    sectionContent(sections, 'progressiveSummary'),
    sectionContent(sections, 'cartContext'),
  ]
    .filter(Boolean)
    .join('\n');
  const recentTurns = formatRecentConversation(
    sectionContent(sections, 'hotMessages') ?? '',
  );

  return [
    summary ? `[Summary and memory]\n${redactPromptPii(summary)}` : '',
    recentTurns ? `[Recent conversation]\n${redactPromptPii(recentTurns)}` : '',
    state.memoryReferences?.length
      ? `[Supervisor memory references]\n${JSON.stringify(state.memoryReferences)}`
      : '',
    `[Current user]\n${safeUserText}`,
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 5000);
}

function promptContextSections(
  promptContext: unknown,
): Array<{ kind?: string; content: string }> {
  if (!promptContext || typeof promptContext !== 'object') return [];
  const sections = (promptContext as { sections?: unknown }).sections;
  if (!Array.isArray(sections)) return [];
  return sections.flatMap((section) => {
    if (!section || typeof section !== 'object') return [];
    const record = section as { kind?: unknown; content?: unknown };
    const content =
      typeof record.content === 'string' ? record.content.trim() : '';
    if (!content) return [];
    return [
      {
        kind: typeof record.kind === 'string' ? record.kind : undefined,
        content,
      },
    ];
  });
}

function sectionContent(
  sections: Array<{ kind?: string; content: string }>,
  kind: string,
): string | undefined {
  return sections.find((section) => section.kind === kind)?.content;
}

function formatRecentConversation(hotMessages: string): string {
  return hotMessages
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-8)
    .map((line) =>
      line
        .replace(/^customer:\s*/i, 'Customer: ')
        .replace(/^user:\s*/i, 'Customer: ')
        .replace(/^assistant:\s*/i, 'Assistant: '),
    )
    .join('\n');
}

function redactPromptPii(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/(?:\+?84|0)(?:[\s.-]?\d){8,10}\b/g, '[redacted-phone]')
    .replace(/\b(?:GVN|DH|ORDER)[-_]?\d{3,}\b/gi, '[redacted-order]');
}

function createOpenRouterSupervisorModel() {
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
          name: 'gearvn_supervisor_decision',
          strict: true,
          schema: SupervisorDecisionJsonSchema,
        },
      },
    },
  });
}

function normalizeSupervisorDecision(
  raw: unknown,
  modelName: string,
): SupervisorDecisionPayload {
  const candidate =
    typeof raw === 'string'
      ? tryParseJson(raw)
      : raw && typeof raw === 'object'
        ? raw
        : null;
  const record = candidate as Record<string, unknown> | null;
  const route = record?.route ?? routeFromIntent(record?.primaryIntent);
  const intents = Array.isArray(record?.intents)
    ? record.intents.map(String)
    : record?.primaryIntent
      ? [String(record.primaryIntent)]
      : undefined;
  const entities =
    record?.entities && typeof record.entities === 'object'
      ? record.entities
      : record?.extractedEntities &&
          typeof record.extractedEntities === 'object'
        ? record.extractedEntities
        : {};
  const parsed = SupervisorDecisionSchema.safeParse({
    ...record,
    route,
    intents,
    entities,
    memoryRefs: Array.isArray(record?.memoryRefs)
      ? record.memoryRefs
      : Array.isArray(record?.memoryReferences)
        ? record.memoryReferences.map((memory) =>
            typeof memory === 'string' ? memory : JSON.stringify(memory),
          )
        : [],
    confidence:
      typeof record?.confidence === 'number' ? record.confidence : 0.6,
    modelName:
      typeof record?.modelName === 'string' ? record.modelName : modelName,
  });
  if (!parsed.success)
    throw new Error('Supervisor decision failed schema validation');
  return parsed.data;
}

function supervisorUpdate(
  state: ShoppingAssistantStateType,
  decision: SupervisorDecisionPayload,
): ShoppingAssistantStateUpdate {
  const normalizedIntents = normalizeIntents(decision.intents, decision.route);
  const reconciledEntities = reconcileCheckoutEntitiesForText(
    state.userText ?? '',
    decision.entities,
  );
  const intents = sanitizeSupervisorIntentsForText(
    normalizedIntents,
    state.userText ?? '',
    reconciledEntities,
  );
  const supervisorDecision: SupervisorDecision = {
    route: decision.route,
    confidence: decision.confidence,
    intents,
    extractedEntities: reconciledEntities,
    memoryReferences: memoryRefsFromDecision(decision.memoryRefs),
    fallbackReason: decision.fallbackReason ?? null,
  };

  return {
    primaryIntent: intents[0] ?? AssistantIntent.UNSUPPORTED,
    intents,
    parsedEntities: reconciledEntities,
    intentPlan: buildIntentPlan(intents, reconciledEntities),
    supervisorDecision,
    activeSubgraph: decision.route,
    metadata: {
      ...(state.metadata ?? {}),
      supervisor_decision: {
        ...supervisorDecision,
        modelName: decision.modelName,
      },
      active_subgraph: decision.route,
      model_name: decision.modelName,
      ...(decision.fallbackReason
        ? { fallback_reason: decision.fallbackReason }
        : {}),
      ...(decision.fallbackReason === 'deterministic_bypass'
        ? {
            deterministic_bypass: true,
            bypass_confidence: decision.confidence,
          }
        : {}),
    },
    traceEvents: [
      {
        roomId: state.roomId,
        node: 'supervisor',
        supervisor_decision: {
          route: decision.route,
          confidence: decision.confidence,
        },
        active_subgraph: decision.route,
        model_name: decision.modelName,
        fallback_reason: decision.fallbackReason,
        ...(decision.fallbackReason === 'deterministic_bypass'
          ? {
              deterministic_bypass: true,
              bypass_confidence: decision.confidence,
            }
          : {}),
      },
    ],
    routeTrace: ['supervisor'],
  };
}

function heuristicSupervisorDecision(
  state: ShoppingAssistantStateType,
  fallbackReason = 'supervisor_model_unavailable',
  modelName = readAssistantModelConfig().openRouter.chatModel,
): SupervisorDecisionPayload {
  const text = state.userText ?? '';
  const conversationContext = buildConversationContext(state);
  const supervisorText = conversationContext.contextualUserText ?? text;

  if (isGreetingOnly(text)) {
    return {
      route: 'general',
      confidence: 1,
      intents: [AssistantIntent.UNSUPPORTED],
      entities: {},
      memoryRefs: [],
      fallbackReason: 'greeting_guidance',
      modelName,
    };
  }

  return (
    deterministicCommerceDecision(
      supervisorText,
      fallbackReason,
      modelName,
      conversationContext,
    ) ?? {
      route: 'general',
      confidence: 0.5,
      intents: [AssistantIntent.UNSUPPORTED],
      entities: {},
      memoryRefs: [],
      fallbackReason,
      modelName,
    }
  );
}

function enrichSupervisorDecision(
  state: ShoppingAssistantStateType,
  decision: SupervisorDecisionPayload,
): SupervisorDecisionPayload {
  if (decision.fallbackReason === 'greeting_guidance') return decision;

  const conversationContext = buildConversationContext(state);
  const supervisorText =
    conversationContext.contextualUserText ?? state.userText ?? '';
  const deterministic = deterministicCommerceDecision(
    supervisorText,
    decision.fallbackReason,
    decision.modelName,
    conversationContext,
  );
  if (!deterministic) return decision;

  const decisionIsUnsupported =
    decision.route === 'general' ||
    decision.intents.includes(AssistantIntent.UNSUPPORTED);
  const normalizedSupervisorText = normalizeCommerceText(supervisorText);
  const ambiguousCartProductReference = isAmbiguousCartProductReference(
    normalizedSupervisorText,
  );
  const shouldCorrectProductInfoUnsupported =
    decisionIsUnsupported &&
    deterministic.route === 'sales' &&
    isProductInformationRequest(normalizedSupervisorText);
  const shouldCorrectUseCaseSetupUnsupported =
    decisionIsUnsupported &&
    deterministic.route === 'sales' &&
    Array.isArray(deterministic.entities.useCaseIntentPrimitives) &&
    deterministic.entities.useCaseIntentPrimitives.length > 0;
  const shouldResolveAmbiguousCartBeforeAction =
    ambiguousCartProductReference &&
    deterministic.route === 'sales' &&
    (decision.route === 'order' ||
      decisionIsUnsupported ||
      decision.intents.includes(AssistantIntent.CART_ACTION) ||
      decision.intents.includes(AssistantIntent.CHECKOUT_PREP));
  const deterministicHasReviewBeforeCart =
    deterministic.intents.includes(AssistantIntent.REVIEW_SUMMARY) &&
    deterministic.intents.includes(AssistantIntent.CART_ACTION) &&
    decision.intents.includes(AssistantIntent.CART_ACTION) &&
    !decision.intents.includes(AssistantIntent.REVIEW_SUMMARY);
  const deterministicCheckoutPrep = deterministic.intents.includes(
    AssistantIntent.CHECKOUT_PREP,
  );
  const decisionIsOrderLookup = decision.intents.includes(
    AssistantIntent.ORDER_LOOKUP,
  );
  const shouldCorrectCheckoutMisroute =
    deterministic.route === 'order' &&
    deterministicCheckoutPrep &&
    (decisionIsUnsupported || decisionIsOrderLookup);
  const shouldUseFallbackDecision =
    (decisionIsUnsupported && decision.confidence < 0.6) ||
    shouldCorrectProductInfoUnsupported ||
    shouldCorrectUseCaseSetupUnsupported ||
    shouldResolveAmbiguousCartBeforeAction ||
    shouldCorrectCheckoutMisroute;
  const deterministicCartAction = deterministic.intents.includes(
    AssistantIntent.CART_ACTION,
  );
  const decisionAlreadyHasCartAction = decision.intents.includes(
    AssistantIntent.CART_ACTION,
  );
  const shouldOverrideRoute =
    shouldUseFallbackDecision ||
    deterministicHasReviewBeforeCart ||
    (deterministicCartAction && !decisionAlreadyHasCartAction);
  const rawMergedEntities = shouldOverrideRoute
    ? {
        ...decision.entities,
        ...deterministic.entities,
      }
    : {
        ...deterministic.entities,
        ...decision.entities,
      };
  const mergedEntities = ambiguousCartProductReference
    ? blockAmbiguousCartActionEntities(rawMergedEntities)
    : rawMergedEntities;

  if (!shouldOverrideRoute && decision.route === deterministic.route) {
    const reconciledIntents = reconcileSalesIntents(
      decision.intents,
      deterministic.intents,
      normalizedSupervisorText,
    );

    return {
      ...decision,
      confidence: Math.max(decision.confidence, deterministic.confidence),
      intents: reconciledIntents,
      entities: mergedEntities,
    };
  }

  if (!shouldOverrideRoute) {
    return {
      ...decision,
      entities: mergedEntities,
    };
  }

  return {
    ...decision,
    route: deterministic.route,
    confidence: Math.max(decision.confidence, deterministic.confidence),
    intents: deterministic.intents,
    entities: mergedEntities,
  };
}

function highConfidenceDeterministicBypassDecision(
  text: string,
  modelName: string,
  conversationContext: ConversationContext,
): SupervisorDecisionPayload | null {
  const normalizedText = normalizeCommerceText(text);
  if (
    !normalizedText ||
    (shouldKeepSupervisorPath(normalizedText) &&
      !isDeterministicPublicReviewRequest(normalizedText))
  ) {
    return null;
  }

  if (isGreetingOnly(text) || isHighConfidenceGreetingRequest(normalizedText)) {
    return {
      route: 'general',
      confidence: 0.96,
      intents: [AssistantIntent.UNSUPPORTED],
      entities: {},
      memoryRefs: [],
      fallbackReason: 'deterministic_bypass',
      modelName,
    };
  }

  if (isStaffHandoffRequest(normalizedText)) {
    return {
      route: 'general',
      confidence: 0.94,
      intents: [AssistantIntent.STAFF_HANDOFF],
      entities: {},
      memoryRefs: [],
      fallbackReason: 'deterministic_bypass',
      modelName,
    };
  }

  const decision = deterministicCommerceDecision(
    text,
    'deterministic_bypass',
    modelName,
    conversationContext,
  );
  if (!decision) return null;

  const bypassEligibleIntents = new Set<string>([
    AssistantIntent.PRODUCT_ADVICE,
    AssistantIntent.REVIEW_SUMMARY,
    AssistantIntent.CART_ACTION,
    AssistantIntent.ORDER_LOOKUP,
  ]);
  const eligibleIntent = decision.intents.some((intent) =>
    bypassEligibleIntents.has(intent),
  );
  if (
    !eligibleIntent ||
    decision.intents.includes(AssistantIntent.CHECKOUT_PREP)
  ) {
    return null;
  }

  if (
    Array.isArray(decision.entities.useCaseIntentPrimitives) &&
    decision.entities.useCaseIntentPrimitives.length > 0 &&
    !isSalesProductRequest(normalizedText)
  ) {
    return null;
  }

  const cartAction = decision.entities.cartAction;
  if (cartAction && cartAction !== 'CART_ADD' && cartAction !== 'CART_REMOVE') {
    return null;
  }

  return {
    ...decision,
    confidence: Math.max(decision.confidence, 0.9),
    fallbackReason: 'deterministic_bypass',
  };
}

function shouldKeepSupervisorPath(normalizedText: string): boolean {
  const explicitPublicSource =
    /tren mang|nguon cong khai|cong dong|public|citation|cite|bao noi|youtube|reddit|tinhte|voz/.test(
      normalizedText,
    );
  const checkoutOrPayment =
    /checkout|thanh toan|dat hang|tao don|len don|chot don|voucher|ma giam gia|coupon|tra gop|vnpay|qr|chuyen khoan/.test(
      normalizedText,
    );
  const deferredOrSensitive =
    /so sanh|compare|bao hanh|warranty|chinh sach|doi tra|refund|return|hoan tien/.test(
      normalizedText,
    );
  const reviewAndCartAction =
    /\b(lay|them|add|chon|mua|dat|xoa|remove)\b/.test(normalizedText) &&
    isReviewRequest(normalizedText);
  const ambiguousCartProductReference =
    isAmbiguousCartProductReference(normalizedText);
  const multiIntent =
    [
      isSalesProductRequest(normalizedText) || isReviewRequest(normalizedText),
      isOrderLookupRequest(normalizedText),
      isCheckoutRequest(normalizedText),
      isStaffHandoffRequest(normalizedText),
    ].filter(Boolean).length > 1;

  return (
    explicitPublicSource ||
    checkoutOrPayment ||
    deferredOrSensitive ||
    reviewAndCartAction ||
    ambiguousCartProductReference ||
    multiIntent
  );
}

function isDeterministicPublicReviewRequest(normalizedText: string): boolean {
  const explicitPublicSource =
    /tren mang|nguon cong khai|cong dong|public|citation|cite|bao noi|youtube|reddit|tinhte|voz/.test(
      normalizedText,
    );
  if (!explicitPublicSource || !isReviewRequest(normalizedText)) return false;

  const actionSensitive =
    isCheckoutRequest(normalizedText) ||
    isOrderLookupRequest(normalizedText) ||
    isStaffHandoffRequest(normalizedText) ||
    isAmbiguousCartProductReference(normalizedText) ||
    /\b(lay|them|add|chon|mua|dat|xoa|remove)\b/.test(normalizedText) ||
    /so sanh|compare|bao hanh|warranty|chinh sach|doi tra|refund|return|hoan tien/.test(
      normalizedText,
    );

  return !actionSensitive;
}

function deterministicCommerceDecision(
  text: string,
  fallbackReason: string | undefined,
  modelName: string,
  conversationContext: ConversationContext = {},
): SupervisorDecisionPayload | null {
  const normalizedText = normalizeCommerceText(text);
  if (!normalizedText || isStaffHandoffRequest(normalizedText)) return null;

  const entities = applyConversationContextEntities(
    extractCommerceEntities(text, normalizedText),
    conversationContext,
  );
  if (isAmbiguousCartProductReference(normalizedText)) {
    return {
      route: 'sales',
      confidence: 0.84,
      intents: [AssistantIntent.PRODUCT_ADVICE],
      entities: blockAmbiguousCartActionEntities(entities),
      memoryRefs: [],
      fallbackReason,
      modelName,
    };
  }

  if (entities.cartAction === 'CART_ADD' && isReviewRequest(normalizedText)) {
    return {
      route: 'sales',
      confidence: 0.84,
      intents: [AssistantIntent.REVIEW_SUMMARY, AssistantIntent.CART_ACTION],
      entities,
      memoryRefs: [],
      fallbackReason,
      modelName,
    };
  }

  if (entities.cartAction === 'CART_ADD') {
    return {
      route: 'order',
      confidence: 0.82,
      intents: [AssistantIntent.CART_ACTION],
      entities,
      memoryRefs: [],
      fallbackReason,
      modelName,
    };
  }

  if (isCheckoutPrepRequest(normalizedText, entities, conversationContext)) {
    return {
      route: 'order',
      confidence: 0.76,
      intents: [AssistantIntent.CHECKOUT_PREP],
      entities,
      memoryRefs: [],
      fallbackReason,
      modelName,
    };
  }

  if (isOrderLookupRequest(normalizedText)) {
    return {
      route: 'order',
      confidence: 0.72,
      intents: [AssistantIntent.ORDER_LOOKUP],
      entities,
      memoryRefs: [],
      fallbackReason,
      modelName,
    };
  }

  const wantsUseCaseSetupAdvice = isUseCaseSetupShoppingConsultation(
    text,
    normalizedText,
  );
  if (
    isReviewRequest(normalizedText) ||
    isSalesProductRequest(normalizedText) ||
    wantsUseCaseSetupAdvice ||
    isShoppingContinuation(conversationContext.reason)
  ) {
    const wantsReview = isReviewRequest(normalizedText);
    const wantsProductAdvice =
      (isSalesProductRequest(normalizedText) || wantsUseCaseSetupAdvice) &&
      (!wantsReview || hasCompanionShoppingRequest(normalizedText));
    const intents = [
      ...(wantsProductAdvice ? [AssistantIntent.PRODUCT_ADVICE] : []),
      ...(wantsReview ? [AssistantIntent.REVIEW_SUMMARY] : []),
    ];

    return {
      route: 'sales',
      confidence: 0.78,
      intents: intents.length ? intents : [AssistantIntent.PRODUCT_ADVICE],
      entities,
      memoryRefs: [],
      fallbackReason,
      modelName,
    };
  }

  return null;
}

function extractCommerceEntities(
  text: string,
  normalizedText: string,
): Record<string, unknown> {
  const entities: Record<string, unknown> = {};
  const reference = extractRecommendationReference(text);
  const requestedMoreOptions = isRequestedMoreOptions(normalizedText);
  const wantsCheaper = /re hon|gia thap hon|gia tot hon/.test(normalizedText);
  const requiresStock = /con hang|co hang|san hang/.test(normalizedText);
  const priceSort = priceSortFromText(normalizedText);

  if (reference) entities.recommendationReference = reference;
  if (requestedMoreOptions) entities.requestedMoreOptions = true;
  if (wantsCheaper) entities.pricePreference = 'cheaper';
  if (priceSort) entities.priceSort = priceSort;
  if (requiresStock) entities.stockRequired = true;

  const productCategory = productCategoryFromText(normalizedText);
  if (productCategory) entities.productCategory = productCategory;

  const useCasePrimitives = detectIntentPrimitives(text);
  const useCaseComboGroups = comboGroupsFromIntentPrimitives(text);
  if (useCasePrimitives.length > 0) {
    entities.useCaseIntentPrimitives = useCasePrimitives.map(
      (primitive) => primitive.id,
    );
  }
  if (useCaseComboGroups.length > 0) {
    entities.comboGroups = useCaseComboGroups;
    entities.categoryHints = useCaseComboGroups;
  }

  const voucherCode = extractVoucherCode(text);
  if (voucherCode) entities.voucherCode = voucherCode;

  const checkout = extractCheckoutFieldsFromText(text, normalizedText);
  if (Object.keys(checkout).length > 0) {
    entities.checkout = checkout;
    if (checkout.name) entities.name = checkout.name;
    if (checkout.phone) entities.phone = checkout.phone;
    if (checkout.address) entities.address = checkout.address;
  }

  if (/xoa|remove/.test(normalizedText)) {
    entities.cartAction = 'CART_REMOVE';
    entities.quantity = 0;
  } else if (/cap nhat|doi so luong|set quantity/.test(normalizedText)) {
    entities.cartAction = 'CART_SET_QUANTITY';
  } else if (
    isCartAddRequest(normalizedText, requestedMoreOptions, reference)
  ) {
    entities.cartAction = 'CART_ADD';
    const productName = reference ? null : extractProductNameForCart(text);
    if (productName) entities.productName = productName;
  }

  const wantsCheckoutRedirect =
    /thanh toan|checkout|dat hang|tao don|len don|chot don|mua hang/.test(
      normalizedText,
    );
  const wantsVoucher = /voucher|coupon|ma giam gia/.test(normalizedText);
  if (wantsCheckoutRedirect) {
    entities.checkoutAction = 'CHECKOUT_REDIRECT';
  } else if (wantsVoucher) {
    entities.checkoutAction = 'APPLY_VOUCHER';
  }
  if (wantsCheckoutRedirect && isCompleteCheckoutFields(checkout)) {
    entities.checkoutReviewAccepted = true;
  }

  const quantity = extractExplicitQuantity(normalizedText);
  if (quantity !== undefined) entities.quantity = quantity;

  if (!requestedMoreOptions && isBroadProductAdviceRequest(normalizedText)) {
    entities.broadNeed = true;
  }

  return entities;
}

function isCheckoutPrepRequest(
  normalizedText: string,
  entities: Record<string, unknown>,
  conversationContext: ConversationContext,
): boolean {
  return (
    isCheckoutRequest(normalizedText) ||
    entities.checkoutAction === 'CHECKOUT_REDIRECT' ||
    conversationContext.reason === 'checkout_contact_continuation'
  );
}

function extractVoucherCode(text: string): string | undefined {
  const match = text.match(
    /(?:voucher|coupon|mã giảm giá|ma giam gia|mã|ma)[:#\s-]+([A-Z0-9_-]{2,24})/i,
  );
  return match?.[1]?.toUpperCase();
}

function extractCheckoutFieldsFromText(
  text: string,
  normalizedText: string,
): { name?: string; phone?: string; address?: string } {
  const phoneMatch = text.match(/(?:\+?84|0)\d(?:[\s.-]?\d){7,9}/);
  const phone = phoneMatch?.[0]?.replace(/\D/g, '') ?? undefined;
  const addressMatch = text.match(
    /(?:địa chỉ|dia chi|address)\s*[:,-]?\s*(.+)$/iu,
  );
  const address = addressMatch?.[1]?.trim();
  const nameMatch = text.match(
    /^\s*(.+?)(?:,|\s+-\s+)?\s*(?:số điện thoại|so dien thoai|sdt|phone|địa chỉ|dia chi|address)\b/iu,
  );
  const normalizedName = nameMatch?.[1]
    ?.replace(
      /^(?:tên|ten|mình tên|minh ten|tôi tên|toi ten|em tên|em ten)\s+/iu,
      '',
    )
    .trim();
  const commaContact = extractPhoneCenteredContactFields(text, phoneMatch);

  return {
    ...(commaContact.name ? { name: commaContact.name } : {}),
    ...(normalizedName ? { name: normalizedName } : {}),
    ...(phone ? { phone } : {}),
    ...(commaContact.address ? { address: commaContact.address } : {}),
    ...(address ? { address } : {}),
    ...(!address && /dia chi|address/.test(normalizedText)
      ? {
          address: text
            .split(/địa chỉ|dia chi|address/iu)
            .pop()
            ?.trim(),
        }
      : {}),
  };
}

function extractPhoneCenteredContactFields(
  text: string,
  phoneMatch?: RegExpMatchArray | null,
): { name?: string; address?: string } {
  if (!phoneMatch?.[0] || phoneMatch.index === undefined) return {};

  const beforePhone = text.slice(0, phoneMatch.index).trim();
  const afterPhone = text.slice(phoneMatch.index + phoneMatch[0].length).trim();
  const name = cleanContactSegment(beforePhone);
  const address = cleanContactSegment(afterPhone);
  const commaSeparated =
    beforePhone.includes(',') || afterPhone.includes(',') || text.includes(',');
  const contactLike =
    commaSeparated &&
    typeof name === 'string' &&
    typeof address === 'string' &&
    /[A-Za-zÀ-ỹ]/.test(name) &&
    /[A-Za-zÀ-ỹ]/.test(address);

  return contactLike ? { name, address } : {};
}

function cleanContactSegment(value: string): string | undefined {
  const cleaned = value
    .replace(/^[\s,;:-]+|[\s,;:-]+$/g, '')
    .replace(
      /^(?:tên|ten|mình tên|minh ten|tôi tên|toi ten|em tên|em ten)\s*[:,-]?\s*/iu,
      '',
    )
    .replace(/^(?:địa chỉ|dia chi|address)\s*[:,-]?\s*/iu, '')
    .trim();
  return cleaned || undefined;
}

function isCompleteCheckoutFields(value: unknown): boolean {
  return Boolean(
    isRecord(value) &&
      typeof value.name === 'string' &&
      value.name.trim() &&
      typeof value.phone === 'string' &&
      value.phone.trim() &&
      typeof value.address === 'string' &&
      value.address.trim(),
  );
}
function isRequestedMoreOptions(normalizedText: string): boolean {
  return /xem them|goi y them|de xuat them|them lua chon|them san pham|them mau|lua chon khac|mau khac|san pham khac|co may khac nua khong|co mau khac|co san pham khac|may khac|mau khac|more options|doi sang|re hon|gia thap hon/.test(
    normalizedText,
  );
}

function priceSortFromText(normalizedText: string): 'asc' | 'desc' | undefined {
  if (
    /gia.*(tren xuong duoi|cao xuong thap|cao den thap|giam dan)|sort.*gia.*(desc|cao|tren)|cao nhat|dat nhat/.test(
      normalizedText,
    )
  ) {
    return 'desc';
  }

  if (
    /gia.*(duoi len tren|thap len cao|thap den cao|tang dan)|sort.*gia.*(asc|thap)|re nhat/.test(
      normalizedText,
    )
  ) {
    return 'asc';
  }

  if (
    /\b(sort|sap xep)\b.*\bgia\b|\bgia\b.*\b(sort|sap xep)\b/.test(
      normalizedText,
    )
  ) {
    return 'asc';
  }

  return undefined;
}
function applyConversationContextEntities(
  entities: Record<string, unknown>,
  context: ConversationContext,
): Record<string, unknown> {
  if (
    !context.contextualUserText &&
    !context.productCategory &&
    !context.reason
  )
    return entities;

  const checkout = isRecord(entities.checkout) ? entities.checkout : undefined;
  const hasCompleteCheckout = Boolean(
    checkout?.name && checkout?.phone && checkout?.address,
  );

  return {
    ...entities,
    ...(context.productCategory &&
    (!entities.productCategory ||
      context.reason === 'shopping_setup_continuation')
      ? { productCategory: context.productCategory }
      : {}),
    ...(context.reason === 'checkout_contact_continuation'
      ? {
          checkoutAction: 'CHECKOUT_REDIRECT',
          ...(hasCompleteCheckout ? { checkoutReviewAccepted: true } : {}),
        }
      : {}),
    ...(context.requestedMoreOptions ? { requestedMoreOptions: true } : {}),
    ...(context.contextualUserText
      ? {
          contextualUserText: context.contextualUserText,
          contextResolutionReason: context.reason,
        }
      : {}),
  };
}

function buildConversationContext(
  state: ShoppingAssistantStateType,
): ConversationContext {
  const currentText = state.userText ?? '';
  const normalizedCurrent = normalizeCommerceText(currentText);
  if (!normalizedCurrent) return {};

  const hotMessages = promptContextSection(state, 'hotMessages');
  if (
    looksLikeCheckoutContactDetails(normalizedCurrent) &&
    hasRecentCheckoutContext(hotMessages)
  ) {
    return {
      contextualUserText: currentText,
      reason: 'checkout_contact_continuation',
    };
  }

  const productInfoFollowUp =
    isProductInformationRequest(normalizedCurrent) &&
    looksLikeDeicticProductReference(normalizedCurrent);
  const currentProductCategory = productCategoryFromText(normalizedCurrent);
  const setupContext = hasRecentSetupShoppingContext(hotMessages);
  if (currentProductCategory && !productInfoFollowUp && !setupContext) {
    return {};
  }
  const requestedMoreOptions = isRequestedMoreOptions(normalizedCurrent);

  const continuationReason = requestedMoreOptions
    ? 'shopping_more_options_continuation'
    : looksLikeShoppingConstraintContinuation(normalizedCurrent)
      ? 'shopping_constraint_continuation'
      : looksLikeAffirmativeContinuation(normalizedCurrent)
        ? 'shopping_affirmation_continuation'
        : productInfoFollowUp
          ? 'shopping_product_info_continuation'
          : setupContext && looksLikeSetupSlotFollowUp(currentText)
            ? 'shopping_setup_continuation'
            : null;
  if (!continuationReason) return {};

  const progressiveSummary = promptContextSection(state, 'progressiveSummary');
  const productCategory =
    (setupContext ? setupFollowUpCategoryFromText(currentText) : undefined) ??
    currentProductCategory ??
    extractLastDiscussedProductCategory(hotMessages) ??
    extractProductCategoryFromRecommendationLedger(
      state.lastRecommendationLedger ?? [],
    ) ??
    extractProductCategoryFromResponseCards(state.responses ?? []) ??
    productCategoryFromText(normalizeCommerceText(progressiveSummary));
  if (!productCategory) return {};

  const priorShoppingText =
    extractPriorCustomerShoppingText(hotMessages, currentText) ??
    extractPriorShoppingTextFromSummary(progressiveSummary, productCategory);
  const moreOptionsResidual = requestedMoreOptions
    ? extractMoreOptionsResidualText(currentText)
    : undefined;
  const combinedContextText =
    continuationReason === 'shopping_affirmation_continuation'
      ? (priorShoppingText ?? productCategory)
      : continuationReason === 'shopping_more_options_continuation'
        ? [priorShoppingText ?? productCategory, moreOptionsResidual]
            .filter(Boolean)
            .join(' ')
            .trim()
        : [priorShoppingText, currentText].filter(Boolean).join(' ').trim();
  const contextualUserText = ensureProductCategoryContext(
    productCategory,
    combinedContextText,
  );

  return {
    productCategory,
    contextualUserText,
    requestedMoreOptions,
    reason: continuationReason,
  };
}

function promptContextSection(
  state: ShoppingAssistantStateType,
  kind: string,
): string {
  const promptContext = state.promptContext as
    | { sections?: Array<{ kind?: unknown; content?: unknown }> }
    | undefined;
  const section = promptContext?.sections?.find((item) => item.kind === kind);
  return typeof section?.content === 'string' ? section.content : '';
}

function extractPriorCustomerShoppingText(
  hotMessages: string,
  currentText: string,
): string | undefined {
  const normalizedCurrent = normalizeCommerceText(currentText);
  const lines = hotMessages
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const match = /^(customer|user):\s*(.+)$/i.exec(lines[index]);
    if (!match) continue;
    const text = match[2].trim();
    const normalizedText = normalizeCommerceText(text);
    if (!normalizedText || normalizedText === normalizedCurrent) continue;
    if (looksLikeAffirmativeContinuation(normalizedText)) continue;
    if (
      mentionsProductCategory(normalizedText) ||
      looksLikeShoppingConstraintContinuation(normalizedText)
    ) {
      return text;
    }
  }

  return undefined;
}

function extractLastDiscussedProductCategory(
  hotMessages: string,
): string | undefined {
  const lines = hotMessages
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const match = /^(customer|user):\s*(.+)$/i.exec(lines[index]);
    if (!match) continue;
    const category = productCategoryFromText(normalizeCommerceText(match[2]));
    if (category) return category;
  }

  return undefined;
}

function extractProductCategoryFromRecommendationLedger(
  ledger: AssistantRecommendationLedgerEntry[],
): string | undefined {
  for (const item of ledger) {
    const category = productCategoryFromText(
      normalizeCommerceText(
        [item.category, item.name].filter(Boolean).join(' '),
      ),
    );
    if (category) return category;
  }
  return undefined;
}

function extractProductCategoryFromResponseCards(
  responses: ShoppingAssistantStateType['responses'],
): string | undefined {
  for (const response of responses ?? []) {
    const cards = Array.isArray(response.metadata?.productCards)
      ? (response.metadata.productCards as AssistantProductCard[])
      : [];
    for (const card of cards) {
      const category = productCategoryFromText(
        normalizeCommerceText(
          [
            card.name,
            ...(card.reasons ?? []),
            JSON.stringify(card.specs ?? {}),
          ].join(' '),
        ),
      );
      if (category) return category;
    }
  }
  return undefined;
}

function extractPriorShoppingTextFromSummary(
  progressiveSummary: string,
  productCategory: string,
): string | undefined {
  const lines = progressiveSummary
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return (
    lines.find((line) =>
      mentionsProductCategory(normalizeCommerceText(line)),
    ) ??
    (lines.length > 0 ? `${productCategory} ${lines.join(' ')}` : undefined)
  );
}

function ensureProductCategoryContext(
  productCategory: string,
  text: string,
): string {
  const trimmed = text.trim();
  if (!trimmed) return productCategory;
  return mentionsProductCategory(normalizeCommerceText(trimmed))
    ? trimmed
    : `${productCategory} ${trimmed}`.trim();
}

function mentionsProductCategory(normalizedText: string): boolean {
  return (
    Boolean(productCategoryFromText(normalizedText)) ||
    /san pham/.test(normalizedText)
  );
}

function looksLikeShoppingConstraintContinuation(
  normalizedText: string,
): boolean {
  return /ngan sach|tam gia|duoi|toi da|khoang|trieu|gaming|game|hoc|machine learning|\bai\b|van phong|do hoa|render|lap trinh|code|creator|hieu nang|mong nhe|pin|man hinh|ram|ssd|cpu|gpu|rtx|gtx|ryzen|intel|uu tien|doi sang|re hon|gia thap hon|con hang|co hang|lua chon khac|khac|goi y them|de xuat them|them san pham|them mau|mau khac|san pham khac|sort|sap xep|gia tu|cao xuong thap|thap len cao|giam dan|tang dan|de|dung de|phuc vu|muc dich|lam/.test(
    normalizedText,
  );
}

function extractMoreOptionsResidualText(text: string): string | undefined {
  const cleaned = text
    .replace(
      /\b(?:co|có)\s+(?:may|máy|mau|mẫu|san pham|sản phẩm|lua chon|lựa chọn)?\s*(?:khac|khác)\s*(?:nua|nữa)?\b/giu,
      ' ',
    )
    .replace(
      /\b(?:xem|goi y|gợi ý|de xuat|đề xuất|them|thêm)\s+(?:lua chon|lựa chọn|san pham|sản phẩm|mau|mẫu)?\s*(?:khac|khác|nua|nữa)?\b/giu,
      ' ',
    )
    .replace(/\b(?:khong|không|ko|nua|nữa)\b/giu, ' ')
    .replace(/[ ,.;]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || undefined;
}

function looksLikeCheckoutContactDetails(normalizedText: string): boolean {
  return /\b0\d{8,10}\b|so dien thoai|sdt|phone|dia chi|address/.test(
    normalizedText,
  );
}

function hasRecentCheckoutContext(hotMessages: string): boolean {
  return /checkout|thanh toan|dat hang|tao don|len don|chot don|voucher|ma giam gia|dia chi|so dien thoai/.test(
    normalizeCommerceText(hotMessages),
  );
}

function isMemoryRecallRequest(text: string): boolean {
  const normalized = normalizeCommerceText(text);
  return /\bnho\b.*(thich|quan tam|nhu cau|gi ve|\bminh\b|\btoi\b|\bem\b)|\b(biet|luu)\b.*(\bminh\b|\btoi\b|\bem\b)|so thich/.test(
    normalized,
  );
}
function looksLikeDeicticProductReference(normalizedText: string): boolean {
  return /\b(nay|do|kia|tren|vua roi|vua neu|dau tien|thu \d+)\b|\b(cai|con|mau|may)\s+(nay|do|kia|dau tien|thu \d+)\b/.test(
    normalizedText,
  );
}

function looksLikeAffirmativeContinuation(normalizedText: string): boolean {
  return /^(co|ok|okay|duoc|duoc nha|co nha|co ban|yes|yep|uh|ừ|vang|vâng|dung roi|chuan)$/.test(
    normalizedText,
  );
}

function isShoppingContinuation(reason?: string): boolean {
  return (
    reason === 'shopping_constraint_continuation' ||
    reason === 'shopping_affirmation_continuation' ||
    reason === 'shopping_product_info_continuation' ||
    reason === 'shopping_more_options_continuation' ||
    reason === 'shopping_setup_continuation'
  );
}

function productCategoryFromText(normalizedText: string): string | undefined {
  return detectProductFamilyFromText(normalizedText);
}
function normalizeCommerceText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\blaptp\b/g, 'laptop')
    .replace(/\blap\s+tp\b/g, 'laptop')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isStaffHandoffRequest(normalizedText: string): boolean {
  return /nhan vien|tu van vien|csr|support|hotline|nguoi that/.test(
    normalizedText,
  );
}

function isOrderLookupRequest(normalizedText: string): boolean {
  return /(?:tra cuu|kiem tra|xem|theo doi|trang thai|lich su).*(?:don hang|order)|(?:don hang|order).*(?:o dau|dang o dau|trang thai|dang giao|da giao|huy|ma don|lich su)/.test(
    normalizedText,
  );
}

function isCheckoutRequest(normalizedText: string): boolean {
  return /gio hang|checkout|thanh toan|voucher|ma giam gia|dat hang|tao don|len don|chot don|mua hang/.test(
    normalizedText,
  );
}

function isSalesProductRequest(normalizedText: string): boolean {
  const mentionsProduct =
    Boolean(productCategoryFromText(normalizedText)) ||
    /gearvn|san pham|may tinh|linh kien/.test(normalizedText);
  const asksForShopping = hasShoppingAdviceLanguage(normalizedText);
  const hasShoppingConstraints =
    /duoi|toi da|tam gia|\btam\b|khoang|trieu|\d{1,3}\s*(trieu|tr)\b|gaming|game|hoc|machine learning|\bai\b|van phong|do hoa|render|lap trinh|code|creator|hieu nang|mong nhe|pin|man hinh|ram|ssd|cpu|gpu|rtx|gtx|ryzen|intel|uu tien/.test(
      normalizedText,
    );
  return (
    mentionsProduct &&
    (asksForShopping ||
      hasShoppingConstraints ||
      isProductInformationRequest(normalizedText))
  );
}

function isUseCaseSetupShoppingConsultation(
  text: string,
  normalizedText: string,
): boolean {
  if (isInformationalDefinitionRequest(normalizedText)) return false;

  const primitives = detectIntentPrimitives(text);
  if (!primitives.some((primitive) => primitive.comboGroups.length > 0)) {
    return false;
  }

  return (
    hasShoppingAdviceLanguage(normalizedText) ||
    hasSetupOrComboMarker(normalizedText)
  );
}

function hasShoppingAdviceLanguage(normalizedText: string): boolean {
  return /tu van|goi y|\bcan\b|can mua|nen mua|chon|mua|co .* nao|review|danh gia/.test(
    normalizedText,
  );
}

function hasSetupOrComboMarker(normalizedText: string): boolean {
  return /\b(setup|set up|combo|full set|build pc|build may|lap rap|rap may|rig|dan may|dan pc|bo may|bo pc|bo gear|tron bo|ca bo)\b|\bgoc\s+(lam viec|livestream|streaming)\b/.test(
    normalizedText,
  );
}

function hasRecentSetupShoppingContext(hotMessages: string): boolean {
  const normalized = normalizeCommerceText(hotMessages);
  if (!normalized) return false;
  return (
    hasSetupOrComboMarker(normalized) ||
    /\b(livestream|streaming|streamer)\b/.test(normalized)
  );
}

function looksLikeSetupSlotFollowUp(text: string): boolean {
  const normalized = normalizeCommerceText(text);
  if (!normalized) return false;
  if (productCategoryFromText(normalized)) return true;
  if (comboGroupsFromIntentPrimitives(text).length > 0) return true;
  return /\b(the con|con|thi sao|co khong|co gi|ve)\b.*\b(ban ghe|ban-ghe-gaming|ghe|webcam|micro|mic|den|lighting|monitor|man hinh|ban phim|chuot|tai nghe)\b/.test(
    normalized,
  );
}

function setupFollowUpCategoryFromText(text: string): string | undefined {
  const normalized = normalizeCommerceText(text);
  if (
    /\bban\s+ghe\b|\bban-ghe-gaming\b/.test(normalized) ||
    /\bbàn\b/iu.test(text)
  ) {
    return 'desk';
  }
  if (/\bghe\b/.test(normalized)) return 'chair';
  return undefined;
}

function isInformationalDefinitionRequest(normalizedText: string): boolean {
  return /\b(la gi|nghia la gi|khai niem|dinh nghia|what is|what are)\b/.test(
    normalizedText,
  );
}

function isProductInformationRequest(normalizedText: string): boolean {
  return /bao hanh|warranty|thong so|cau hinh|spec|kich thuoc|tan so quet|do phan giai|cong ket noi|cong suat|nang cap|nang duoc|ho tro/.test(
    normalizedText,
  );
}

function isReviewRequest(normalizedText: string): boolean {
  return (
    /review|danh gia|nguon/.test(normalizedText) ||
    /(?:thong so|thong tin|cau hinh|spec).*?(?:chi tiet|nhu nao|ra sao)|(?:chi tiet|detail).*?(?:san pham|laptop|may|mau|con)|(?:thong so|cau hinh|spec)\b/.test(
      normalizedText,
    )
  );
}

function sanitizeSupervisorIntentsForText(
  intents: AssistantIntent[],
  userText: string,
  entities: Record<string, unknown>,
): AssistantIntent[] {
  const normalizedText = normalizeCommerceText(userText);
  if (
    isCheckoutContinuationOrRedirect(entities) &&
    !isExplicitOrderLookupRequest(normalizedText)
  ) {
    const withoutLookup = intents.filter(
      (intent) => intent !== AssistantIntent.ORDER_LOOKUP,
    );
    return withoutLookup.includes(AssistantIntent.CHECKOUT_PREP)
      ? withoutLookup
      : [AssistantIntent.CHECKOUT_PREP, ...withoutLookup];
  }

  const explicitlyNeedsReview =
    isReviewRequest(normalizedText) ||
    entities.needsReviewSummary === true ||
    entities.reviewSummary === true;
  const hasActionRequest =
    Boolean(entities.cartAction) || Boolean(entities.checkoutAction);
  if (
    explicitlyNeedsReview &&
    intents.includes(AssistantIntent.REVIEW_SUMMARY) &&
    isReviewOnlyRequest(normalizedText) &&
    !hasActionRequest
  ) {
    return [AssistantIntent.REVIEW_SUMMARY];
  }

  if (!intents.includes(AssistantIntent.REVIEW_SUMMARY)) return intents;
  if (explicitlyNeedsReview) return intents;

  const sanitized = intents.filter(
    (intent) => intent !== AssistantIntent.REVIEW_SUMMARY,
  );
  return sanitized.length > 0 ? sanitized : [AssistantIntent.PRODUCT_ADVICE];
}

function reconcileCheckoutEntitiesForText(
  userText: string,
  entities: Record<string, unknown>,
): Record<string, unknown> {
  if (!isCheckoutContinuationOrRedirect(entities)) return entities;
  if (isExplicitOrderLookupRequest(normalizeCommerceText(userText)))
    return entities;

  return {
    ...entities,
    checkoutAction: entities.checkoutAction ?? 'CHECKOUT_REDIRECT',
    needsOrderLookup: false,
  };
}

function isCheckoutContinuationOrRedirect(
  entities: Record<string, unknown>,
): boolean {
  return (
    entities.checkoutAction === 'CHECKOUT_REDIRECT' ||
    entities.contextResolutionReason === 'checkout_contact_continuation'
  );
}

function isExplicitOrderLookupRequest(normalizedText: string): boolean {
  return /\b(don hang|order|ma don|tracking|van don|trang thai don|kiem tra don|tra cuu don)\b/.test(
    normalizedText,
  );
}
function reconcileSalesIntents(
  decisionIntents: string[],
  deterministicIntents: string[],
  normalizedText: string,
): string[] {
  const deterministicNeedsReview = deterministicIntents.includes(
    AssistantIntent.REVIEW_SUMMARY,
  );
  if (deterministicNeedsReview && isReviewOnlyRequest(normalizedText)) {
    return [AssistantIntent.REVIEW_SUMMARY];
  }
  if (!decisionIntents.includes(AssistantIntent.REVIEW_SUMMARY)) {
    return decisionIntents;
  }
  if (isReviewRequest(normalizedText)) return decisionIntents;

  const sanitized = decisionIntents.filter(
    (intent) => intent !== AssistantIntent.REVIEW_SUMMARY,
  );
  return sanitized.length > 0 ? sanitized : deterministicIntents;
}

function isReviewOnlyRequest(normalizedText: string): boolean {
  return (
    isReviewRequest(normalizedText) &&
    !hasCompanionShoppingRequest(normalizedText)
  );
}

function hasCompanionShoppingRequest(normalizedText: string): boolean {
  return /tu van|goi y|can mua|nen mua|chon|lua chon|san pham nao|co .* nao|mua|gia|bao nhieu|con hang|co hang|duoi|toi da|tam gia|\btam\b|khoang|trieu|so sanh/.test(
    normalizedText,
  );
}

function isBroadProductAdviceRequest(normalizedText: string): boolean {
  const asksForAdvice = /\b(tu van|goi y|can mua|can|nen mua|chon)\b/.test(
    normalizedText,
  );
  const mentionsGenericProduct = /\b(laptop|pc|may tinh|san pham)\b/.test(
    normalizedText,
  );
  if (!asksForAdvice || !mentionsGenericProduct) return false;

  return !specificProductAdviceResidual(normalizedText);
}

function specificProductAdviceResidual(normalizedText: string): string {
  return normalizedText
    .replace(
      /\b(tu van|goi y|can mua|can|nen mua|chon|ve|cho|minh|toi|em|shop|nhe|nha|giup|voi|tao|tui|to|ban|co|a|anh|chi|de)\b/g,
      ' ',
    )
    .replace(/\b(laptop|pc|may tinh|san pham|mau|may|bo)\b/g, ' ')
    .replace(/\b(pho thong|co ban|basic|entry level)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isAmbiguousCartProductReference(normalizedText: string): boolean {
  if (hasOrdinalProductReference(normalizedText)) return false;
  if (!isCartAddRequest(normalizedText, false, null)) return false;

  const hasAlternative = /\b(hoac|hay|or)\b|\//.test(normalizedText);
  const hasRecentDeictic =
    /\b(o tren|ben tren|vua neu|vua roi|vua recommend|tren)\b/.test(
      normalizedText,
    );
  return (
    countProductFamilySignals(normalizedText) >= 2 &&
    (hasAlternative || hasRecentDeictic)
  );
}

function hasOrdinalProductReference(normalizedText: string): boolean {
  return /(?:cai|mau|con|san pham)\s+thu\s+\d+|thu\s+\d+|(?:cai|mau|con|san pham)\s+(dau|nhat|mot|hai|ba|bon|tu|nam)|thu\s+(dau|nhat|mot|hai|ba|bon|tu|nam)/.test(
    normalizedText,
  );
}

function countProductFamilySignals(normalizedText: string): number {
  return AMBIGUOUS_CART_PRODUCT_FAMILY_TERMS.filter((term) =>
    new RegExp(`\\b${term}\\b`).test(normalizedText),
  ).length;
}

function blockAmbiguousCartActionEntities(
  entities: Record<string, unknown>,
): Record<string, unknown> {
  const safeEntities = { ...entities };
  delete safeEntities.cartAction;
  delete safeEntities.checkoutAction;
  delete safeEntities.productName;
  delete safeEntities.quantity;
  return {
    ...safeEntities,
    pendingCartAction: 'CART_ADD',
    requiresProductSelection: true,
    blockedCartActionReason: 'ambiguous_product_reference',
  };
}
function isCartAddRequest(
  normalizedText: string,
  requestedMoreOptions: boolean,
  reference: string | null,
): boolean {
  if (requestedMoreOptions) return false;
  const addVerb = /\b(lay|them|add|chon|mua|dat)\b/.test(normalizedText);
  if (reference && addVerb) return true;
  return (
    /^(lay|them|add|chon|mua)\b/.test(normalizedText) ||
    /\bvao gio\b|\bcart\b/.test(normalizedText)
  );
}

function extractProductNameForCart(text: string): string | null {
  const match = text.match(
    /^\s*(?:lấy|lay|thêm|them|add)\s+(?:cho\s+(?:mình|minh|tôi|toi|em)\s+)?(?:giúp\s+(?:mình|minh)\s+)?(?:con|mẫu|mau|cái|cai|sản phẩm|san pham)?\s*(.+?)(?:\s+(?:vào|vao)\s+(?:giỏ|gio|cart).*)?$/iu,
  );
  const productName = match?.[1]
    ?.replace(/\s+(?:nhé|nhe|nha|bạn|ban)$/iu, '')
    .trim();
  if (!productName || /^c[aá]i\s+/iu.test(productName)) return null;
  if (isOrdinalOnlyReference(productName)) return null;
  const normalizedProductName = normalizeCommerceText(productName);
  if (isOrdinalOnlyReference(normalizedProductName)) return null;
  if (
    /^(?:vao\s+)?(?:gio|gio hang|cart)(?:\s+(?:cho|minh|toi|em|giup|nhe|nha|ban))*$/.test(
      normalizedProductName,
    )
  ) {
    return null;
  }
  return productName;
}

function extractRecommendationReference(text: string): string | null {
  return extractRankRecommendationReference(text)?.phrase ?? null;
}

function extractExplicitQuantity(normalizedText: string): number | undefined {
  const explicit = normalizedText.match(
    /(?:so luong|qty|quantity)\s*(\d{1,3})\b/,
  );
  if (explicit) return Number(explicit[1]);

  const classifier = normalizedText.match(/\b(\d{1,2})\s*(?:cai|chiec|sp)\b/);
  return classifier ? Number(classifier[1]) : undefined;
}

function routeFromIntent(intent: unknown): AssistantSubgraphName | undefined {
  if (typeof intent !== 'string') return undefined;
  if (ROUTE_INTENTS.sales.includes(intent as AssistantIntent)) return 'sales';
  if (ROUTE_INTENTS.order.includes(intent as AssistantIntent)) return 'order';
  return 'general';
}

function normalizeIntents(
  intents: string[],
  route: AssistantSubgraphName,
): AssistantIntent[] {
  const allowed = new Set(Object.values(AssistantIntent));
  const normalized = intents.filter((intent): intent is AssistantIntent =>
    allowed.has(intent as AssistantIntent),
  );
  return normalized.length > 0 ? normalized : ROUTE_INTENTS[route];
}

function buildIntentPlan(
  intents: AssistantIntent[],
  entities: Record<string, unknown>,
): Record<string, unknown> {
  return {
    primaryIntent: intents[0],
    intents,
    cartAction: entities.cartAction,
    checkoutAction: entities.checkoutAction,
    orderStatus: entities.orderStatus,
    broadNeed: entities.broadNeed,
    requestedMoreOptions: entities.requestedMoreOptions,
    contextualUserText: entities.contextualUserText,
    contextResolutionReason: entities.contextResolutionReason,
    priceSort: entities.priceSort,
    needsProductRetrieval: intents.includes(AssistantIntent.PRODUCT_ADVICE),
    needsReviewSummary: intents.includes(AssistantIntent.REVIEW_SUMMARY),
    needsOrderLookup: intents.includes(AssistantIntent.ORDER_LOOKUP),
  };
}

function memoryRefsFromDecision(
  memoryRefs: string[],
): AssistantMemoryReference[] {
  return memoryRefs.map((label) => ({
    kind: 'preference',
    label,
  }));
}

function maybeGreetingSupervisorDecision(
  state: ShoppingAssistantStateType,
  modelName: string,
): SupervisorDecisionPayload | null {
  if (!isGreetingOnly(state.userText ?? '')) return null;

  return {
    route: 'general',
    confidence: 1,
    intents: [AssistantIntent.UNSUPPORTED],
    entities: {},
    memoryRefs: [],
    fallbackReason: 'greeting_guidance',
    modelName,
  };
}

function isHighConfidenceGreetingRequest(normalizedText: string): boolean {
  return /^(hi|hello|hey|alo|chao|xin chao)(\s+(ban|shop|gearvn|gearvn oi))?$/.test(
    normalizedText,
  );
}

function isCourtesyOnly(text: string): boolean {
  const normalized = normalizeCommerceText(text);
  return /^(cam on|cam on nhe|ok cam on|ok cam on nhe|thanks|thank you|ok thanks|ok|duoc roi|tam biet|bye)$/.test(
    normalized,
  );
}
function isGreetingOnly(text: string): boolean {
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return /^(hi|hello|hey|alo|chao|xin chao|chao ban|chao shop|shop oi|gearvn oi)$/.test(
    normalized,
  );
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
      reject(new Error('supervisor_model_timeout'));
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
function redactCustomerPii(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/(?:\+?84|0)(?:[\s.-]?\d){8,10}\b/g, '[redacted-phone]')
    .replace(/\b(?:GVN|DH|ORDER)[-_]?\d{3,}\b/gi, '[redacted-order]')
    .replace(
      /(?:dia chi|địa chỉ|address)\s*[:：]?\s*[^,.;\n]+/gi,
      'address: [redacted-address]',
    )
    .replace(
      /(?:ten|tên|name)\s*[:：]?\s*[^,.;\n]+/gi,
      'name: [redacted-name]',
    );
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
