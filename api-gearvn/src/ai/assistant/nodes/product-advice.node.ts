import {
  ProductCatalogAdapter,
  ProductCatalogSnapshot,
} from '../adapters/product-catalog.adapter';
import { ProductRetriever } from '../../retrieval/product-retriever';
import {
  extractHardConstraints,
  mergeRetrievalConstraints,
  productCandidateSatisfiesHardConstraints,
} from '../../retrieval/product-reranker';
import {
  ProductGroupCoverage,
  ProductRetrievalConstraints,
  ProductRetrievalResult,
  ProductRetrievalRewriteMetadata,
  RerankedProductCandidate,
} from '../../retrieval/product-retrieval.types';
import { comboGroupsFromIntentPrimitives } from '../../retrieval/product-intent-primitives';
import { detectProductFamilyFromText } from '../../retrieval/product-family-taxonomy';
import type {
  AssistantPriorRecommendationContext,
  AssistantProductCard,
  AssistantProductConsultationMode,
  AssistantRecommendationLedgerEntry,
} from '../assistant.types';
import { readAssistantRecommendationConfig } from '../config/assistant-recommendation.config';
import type { AssistantResponseComposer } from '../assistant-response-composer.service';
import type { AssistantSessionService } from '../assistant-session.service';

export { ProductCatalogAdapter } from '../adapters/product-catalog.adapter';

type ProductAdviceState = {
  roomId?: string;
  userText: string;
  intentPlan?: {
    needsProductRetrieval?: boolean;
    broadNeed?: boolean;
    requestedMoreOptions?: boolean;
    contextualUserText?: unknown;
    priceSort?: unknown;
    contextResolutionReason?: unknown;
  };
  parsedEntities?: Record<string, unknown>;
  requestedMoreOptions?: boolean;
};

type ProductAdviceConfig = {
  productRetriever?: ProductRetriever;
  catalogAdapter?: ProductCatalogAdapter;
  responseComposer?: AssistantResponseComposer;
  sessionService?: AssistantSessionService;
  roomId?: string;
  promptContext?: unknown;
  abortSignal?: AbortSignal;
  composeTimeoutMs?: number;
  rewriteTimeoutMs?: number;
};

type ProductAdviceCard = AssistantProductCard;

type ProductAdviceProductGroup = {
  groupId: string;
  label: string;
  productCards: ProductAdviceCard[];
};

type ProductAdviceSlotCoverage = {
  requestedSlots: string[];
  coveredSlots: string[];
  missingSlots: string[];
};

type ProductAdviceComposeResult = {
  text: string | null;
  fallbackReason?: string;
};

type ProductAdviceComposeMetadata = {
  text: string;
  llmComposed: boolean;
  llmComposeStatus: 'skipped' | 'used' | 'fallback';
  llmComposeFallbackReason?: string;
};

type ProductAdviceToolResults = {
  search_products: {
    retrieval_query?: string;
    crag_retry?: unknown;
    productIds: string[];
  };
  get_product_snapshot: {
    productIds: string[];
    count: number;
  };
};

type ProductAdviceResult = {
  intent: 'PRODUCT_ADVICE';
  nodeName: 'product_advice';
  text: string;
  metadata: {
    productCards: ProductAdviceCard[];
    followUpQuestions: string[];
    needsClarification?: boolean;
    retrievalQuery?: unknown;
    retrieval_query?: string;
    crag_retry?: unknown;
    productIds?: string[];
    productGroups?: ProductAdviceProductGroup[];
    group_coverage?: ProductGroupCoverage;
    setup_slot_coverage?: ProductAdviceSlotCoverage;
    combo_group_count?: number;
    active_subgraph?: 'sales';
    tool_calls?: ReturnType<typeof buildProductToolCalls>;
    tool_results?: ProductAdviceToolResults;
    requested_recommendation_limit?: number | null;
    applied_recommendation_limit?: number;
    product_card_count?: number;
    price_sort?: PriceSortDirection;
    consultationMode?: AssistantProductConsultationMode;
    priorRecommendationProductIds?: string[];
    comparedProductIds?: string[];
    recommendationContinuity?: {
      mode: AssistantProductConsultationMode;
      hasPriorRecommendations: boolean;
      priorRecommendationProductIds: string[];
      comparedProductIds: string[];
      preferenceDelta?: string;
    };
    rewrite_provider?: string;
    rewrite_model?: string;
    rewrite_status?: string;
    rewrite_retry_count?: number;
    rewrite_latency_ms?: number;
    rewritten_query?: string;
    rewrite_skipped_reason?: string;
    llmComposed: boolean;
    llmComposeStatus?: 'skipped' | 'used' | 'fallback';
    llmComposeFallbackReason?: string;
  };
};

const PRODUCT_ADVICE_COMPOSE_TIMEOUT_MS = 42_000;
const PRODUCT_ADVICE_REWRITE_TIMEOUT_MS = 12_000;
const SETUP_SLOT_FOLLOW_UP_TIMEOUT_MS = 7_000;
const SETUP_SLOT_SNAPSHOT_TIMEOUT_MS = 2_000;

const PRODUCT_COUNT_NOUN_PATTERN =
  'mau|san pham|the san pham|model|models|lua chon|goi y|recommendation|recommendations|option|options|product|products|laptop|laptops|may tinh|may|con';
const PRODUCT_COUNT_WORDS: Record<string, number> = {
  'muoi mot': 11,
  'muoi hai': 12,
  mot: 1,
  hai: 2,
  ba: 3,
  bon: 4,
  nam: 5,
  sau: 6,
  bay: 7,
  tam: 8,
  chin: 9,
  muoi: 10,
};
const PRODUCT_COUNT_WORD_PATTERN = Object.keys(PRODUCT_COUNT_WORDS)
  .sort((left, right) => right.length - left.length)
  .join('|');
const PRODUCT_ADVICE_FOLLOW_UP_QUESTIONS = [
  'Bạn dự kiến ngân sách khoảng bao nhiêu?',
  'Bạn dùng chính để học/làm việc, chơi game, đồ họa hay di chuyển nhiều?',
  'Bạn ưu tiên màn hình, hiệu năng, pin hay mỏng nhẹ?',
];
const SETUP_ADVICE_FOLLOW_UP_QUESTIONS = [
  'Bạn muốn dùng PC để bàn hay laptop?',
  'Ngân sách tổng cho góc setup khoảng bao nhiêu?',
  'Bạn cần gồm những món nào: bàn, ghế, micro, camera, đèn hay màn hình?',
];
const SETUP_PC_CLARIFICATION_QUESTIONS = [
  'Bạn muốn mua PC bộ lắp sẵn hay build theo linh kiện?',
  'Ngân sách cho riêng PC khoảng bao nhiêu?',
];
const PHASE_10_CLARIFICATION_QUESTIONS = [
  'Bạn ưu tiên laptop, PC hay phụ kiện?',
  'Ngân sách khoảng bao nhiêu?',
];

export async function productAdviceNode(
  state: ProductAdviceState,
  config: ProductAdviceConfig,
): Promise<ProductAdviceResult> {
  const requestedMoreOptions =
    state.intentPlan?.requestedMoreOptions === true ||
    state.requestedMoreOptions === true;
  const contextualSetupAdvice = isContextualSetupProductAdvice(state);
  const setupClarificationQuestions = setupClarificationQuestionsForState(
    state,
    contextualSetupAdvice,
  );
  const broadNeed =
    state.intentPlan?.broadNeed === true ||
    isBroadProductAdviceRequest(state.userText);
  const shouldClarifyBroadNeed = broadNeed && !contextualSetupAdvice;
  const followUpQuestions = shouldClarifyBroadNeed
    ? PRODUCT_ADVICE_FOLLOW_UP_QUESTIONS
    : [];

  if (setupClarificationQuestions.length > 0 && !requestedMoreOptions) {
    return {
      intent: 'PRODUCT_ADVICE',
      nodeName: 'product_advice',
      text: buildClarificationText(setupClarificationQuestions),
      metadata: {
        productCards: [],
        followUpQuestions: setupClarificationQuestions,
        needsClarification: true,
        llmComposed: false,
        llmComposeStatus: 'skipped',
        llmComposeFallbackReason: 'setup_fast_clarification',
      },
    };
  }

  if (shouldClarifyBroadNeed && !requestedMoreOptions) {
    const clarification = await composeProductClarificationText(config, {
      userText: sanitizeCustomerFacingRequest(state.userText),
      followUpQuestions,
    });
    return {
      intent: 'PRODUCT_ADVICE',
      nodeName: 'product_advice',
      text: clarification.text,
      metadata: {
        productCards: [],
        followUpQuestions,
        needsClarification: true,
        llmComposed: clarification.llmComposed,
        llmComposeStatus: clarification.llmComposeStatus,
        ...(clarification.llmComposeFallbackReason
          ? {
              llmComposeFallbackReason: clarification.llmComposeFallbackReason,
            }
          : {}),
      },
    };
  }

  throwIfAborted(config.abortSignal);
  const recommendationConfig = readAssistantRecommendationConfig();
  const requestedRecommendationLimit = parseRequestedRecommendationLimit(
    state.userText,
    recommendationConfig.maxLimit,
  );
  const cardLimit =
    requestedRecommendationLimit ??
    (requestedMoreOptions
      ? Math.min(
          recommendationConfig.moreOptionsLimit,
          recommendationConfig.maxLimit,
        )
      : Math.min(
          recommendationConfig.defaultLimit,
          recommendationConfig.maxLimit,
        ));
  const priceSort = priceSortFromState(state);
  const roomId = config.roomId ?? state.roomId;
  const priorRecommendationSort =
    priceSort && isPriorRecommendationSortRequest(state.userText);

  if (priorRecommendationSort && roomId) {
    const ledger =
      (await config.sessionService?.getLastRecommendationLedger(roomId)) ?? [];
    throwIfAborted(config.abortSignal);
    if (ledger.length > 0) {
      const ledgerLimit = requestedRecommendationLimit
        ? Math.min(requestedRecommendationLimit, recommendationConfig.maxLimit)
        : Math.min(ledger.length, recommendationConfig.maxLimit);
      const productCards = uniqueProductCardsByProductId(
        sortLedgerByRequestedPrice(ledger, priceSort).map(
          productCardFromLedger,
        ),
      ).slice(0, ledgerLimit);
      const productIds = productCards.map((card) => card.productId);

      if (productCards.length > 0) {
        await config.sessionService?.saveRecommendationLedger(
          roomId,
          productCards,
        );
        throwIfAborted(config.abortSignal);
      }
      const priorRecommendations = priorRecommendationsFromLedger(ledger);
      const preferenceDelta = sanitizeCustomerFacingRequest(state.userText);
      const advice = await composeGroundedProductAdviceText(config, {
        userText: preferenceDelta,
        productCards,
        followUpQuestions,
        priorRecommendations,
        preferenceDelta,
        consultationMode: 'price_sort',
      });

      return {
        intent: 'PRODUCT_ADVICE',
        nodeName: 'product_advice',
        text: advice.text,
        metadata: {
          productCards,
          followUpQuestions,
          productIds,
          active_subgraph: 'sales',
          tool_results: {
            search_products: {
              retrieval_query: 'last_recommendation_ledger',
              productIds,
            },
            get_product_snapshot: {
              productIds,
              count: productCards.length,
            },
          },
          requested_recommendation_limit: requestedRecommendationLimit,
          applied_recommendation_limit: productCards.length,
          price_sort: priceSort,
          product_card_count: productCards.length,
          ...continuityMetadata({
            mode: 'price_sort',
            priorRecommendations,
            comparedProductIds: productIds,
            preferenceDelta,
          }),
          llmComposed: advice.llmComposed,
          llmComposeStatus: advice.llmComposeStatus,
          ...(advice.llmComposeFallbackReason
            ? { llmComposeFallbackReason: advice.llmComposeFallbackReason }
            : {}),
        },
      };
    }
  }

  const productRetriever =
    config.productRetriever ?? config.catalogAdapter?.productRetriever;
  if (!productRetriever) {
    throw new Error('productAdviceNode requires ProductRetriever');
  }

  const setupSlotFollowUpGroups = setupSlotFollowUpGroupsForState(
    state,
    contextualSetupAdvice,
  );
  if (setupSlotFollowUpGroups.length > 0 && !requestedMoreOptions) {
    return fastSetupSlotFollowUpResponse({
      state,
      config,
      productRetriever,
      groups: setupSlotFollowUpGroups,
      roomId,
      cardLimit,
    });
  }

  const customerFacingText = stripProductAdviceControlPhrases(
    normalizeProductSearchQuery(productCustomerText(state)),
  );
  const searchQuery = stripProductAdviceControlPhrases(
    normalizeProductSearchQuery(productSearchText(state)),
  );
  const responseUserText = sanitizeCustomerFacingRequest(
    customerFacingText || searchQuery,
  );
  const hardConstraints = productAdviceHardConstraints(state, searchQuery);
  const requestedConsultationMode = productConsultationModeFromState(
    state,
    requestedMoreOptions,
    priorRecommendationSort,
  );
  const priorRecommendations = await priorRecommendationsForMode(
    config,
    roomId,
    requestedConsultationMode,
  );
  throwIfAborted(config.abortSignal);
  const consultationMode = effectiveConsultationMode(
    requestedConsultationMode,
    priorRecommendations,
  );
  const preferenceDelta = sanitizeCustomerFacingRequest(state.userText);
  const excludedProductIds = requestedMoreOptions
    ? priorRecommendations.map((item) => item.productId)
    : [];
  throwIfAborted(config.abortSignal);
  const excludedProductIdSet = new Set(excludedProductIds);
  const retrievalLimit = priceSort
    ? Math.max(cardLimit, recommendationConfig.maxLimit)
    : requestedMoreOptions
      ? Math.min(
          recommendationConfig.maxLimit,
          cardLimit + excludedProductIdSet.size,
        )
      : cardLimit;
  const useFastCatalogSearch =
    !requestedMoreOptions &&
    shouldUseFastCatalogSearch(searchQuery) &&
    typeof config.catalogAdapter?.searchProductsFast === 'function';
  const allowDeterministicRewriteShortCircuit =
    !requestedMoreOptions &&
    !useFastCatalogSearch &&
    priceSort === undefined &&
    !isSetupOrComboProductAdvice(`${state.userText} ${searchQuery}`);
  const retrieval = await searchProductCatalog(
    config,
    productRetriever,
    searchQuery,
    useFastCatalogSearch,
    retrievalLimit,
    {
      query: searchQuery,
      originalQuery: state.userText,
      clarificationAnswer: asString(state.intentPlan?.contextualUserText),
      hardConstraints,
      allowDeterministicShortCircuit: allowDeterministicRewriteShortCircuit,
    },
  );
  throwIfAborted(config.abortSignal);
  const visibleConstraints = mergeActiveRetrievalConstraints(
    retrieval.query.constraints,
    hardConstraints,
  );
  if (retrieval.clarification?.needed === true) {
    const followUpQuestions = PHASE_10_CLARIFICATION_QUESTIONS.slice(0, 2);
    const clarification = await composeProductClarificationText(config, {
      userText: responseUserText,
      followUpQuestions,
    });
    return {
      intent: 'PRODUCT_ADVICE',
      nodeName: 'product_advice',
      text: clarification.text,
      metadata: {
        productCards: [],
        followUpQuestions,
        needsClarification: true,
        retrievalQuery: retrieval.query,
        retrieval_query: retrieval.effectiveQuery ?? searchQuery,
        productIds: [],
        active_subgraph: 'sales',
        ...rewriteTraceMetadata(retrieval),
        requested_recommendation_limit: requestedRecommendationLimit,
        applied_recommendation_limit: 0,
        product_card_count: 0,
        llmComposed: clarification.llmComposed,
        llmComposeStatus: clarification.llmComposeStatus,
        ...(clarification.llmComposeFallbackReason
          ? {
              llmComposeFallbackReason: clarification.llmComposeFallbackReason,
            }
          : {}),
      },
    };
  }
  if (retrieval.comboGroups?.length) {
    const groupResults = retrieval.comboGroups.map((group) => ({
      groupId: group.id,
      label: group.label,
      results: group.results.slice(0, 3),
    }));
    const candidateResults = uniqueResultsByProductId(
      groupResults.flatMap((group) => group.results),
    );
    const candidateProductIds = candidateResults.map(
      (result) => result.productId,
    );
    const snapshots: ProductCatalogSnapshot[] =
      (await config.catalogAdapter?.getSnapshotsByIds(candidateProductIds)) ??
      candidateResults.map(snapshotFromResult);
    throwIfAborted(config.abortSignal);
    const snapshotById = new Map<string, ProductCatalogSnapshot>(
      snapshots.map((snapshot) => [snapshot.productId, snapshot] as const),
    );
    const comboVisibleConstraints =
      withoutCategoryConstraints(visibleConstraints);
    const initialProductGroups: ProductAdviceProductGroup[] =
      uniqueProductGroupsByProductId(
        groupResults
          .map((group) => ({
            groupId: group.groupId,
            label: group.label,
            productCards: group.results
              .filter((result) => {
                if (excludedProductIdSet.has(result.productId)) return false;
                const snapshot = snapshotById.get(result.productId);
                if (snapshot && Number(snapshot.stock ?? 0) <= 0) return false;
                return snapshot
                  ? resultSatisfiesVisibleConstraints(
                      result,
                      snapshot,
                      comboVisibleConstraints,
                    )
                  : false;
              })
              .slice(0, 3)
              .map((result) =>
                toProductCard(result, snapshotById.get(result.productId)!),
              ),
          }))
          .filter((group) => group.productCards.length > 0),
      );
    const productGroups = gateComboProductGroups(
      initialProductGroups,
      retrieval,
      searchQuery,
    );
    const productCards = productGroups.flatMap((group) => group.productCards);
    const productIds = productCards.map((card) => card.productId);
    const slotCoverage = slotCoverageFromRetrieval(retrieval, productGroups);
    const displayedGroupCoverage = groupCoverageFromSlotCoverage(slotCoverage);

    throwIfAborted(config.abortSignal);
    if (roomId && productCards.length > 0) {
      await config.sessionService?.saveRecommendationLedger(
        roomId,
        productCards,
      );
    }
    throwIfAborted(config.abortSignal);

    const advice = await composeGroundedProductAdviceText(config, {
      userText: responseUserText,
      productCards,
      followUpQuestions,
      priorRecommendations,
      preferenceDelta,
      consultationMode:
        productCards.length > 0 ? 'combo_advice' : consultationMode,
      slotCoverage,
    });

    return {
      intent: 'PRODUCT_ADVICE',
      nodeName: 'product_advice',
      text:
        productCards.length > 0 ? advice.text : minimalNoResultText(retrieval),
      metadata: {
        productCards,
        productGroups,
        followUpQuestions,
        retrievalQuery: retrieval.query,
        retrieval_query: retrieval.effectiveQuery ?? searchQuery,
        crag_retry: retrieval.cragRetry ?? retrieval.crag_retry,
        productIds,
        group_coverage: displayedGroupCoverage,
        setup_slot_coverage: slotCoverage,
        combo_group_count: retrieval.comboGroups.length,
        active_subgraph: 'sales',
        tool_calls: buildProductToolCalls(retrieval, productIds),
        tool_results: {
          search_products: {
            retrieval_query: retrieval.effectiveQuery ?? searchQuery,
            crag_retry: retrieval.cragRetry ?? retrieval.crag_retry,
            productIds,
          },
          get_product_snapshot: {
            productIds,
            count: productCards.length,
          },
        },
        ...rewriteTraceMetadata(retrieval),
        requested_recommendation_limit: requestedRecommendationLimit,
        applied_recommendation_limit: productCards.length,
        price_sort: priceSort,
        product_card_count: productCards.length,
        ...continuityMetadata({
          mode: productCards.length > 0 ? 'combo_advice' : consultationMode,
          priorRecommendations,
          comparedProductIds: productIds,
          preferenceDelta,
        }),
        llmComposed: productCards.length > 0 ? advice.llmComposed : false,
        llmComposeStatus:
          productCards.length > 0 ? advice.llmComposeStatus : 'skipped',
        ...(productCards.length > 0 && advice.llmComposeFallbackReason
          ? { llmComposeFallbackReason: advice.llmComposeFallbackReason }
          : {}),
      },
    };
  }

  const candidateResults = retrieval.results.filter(
    (result) => !excludedProductIdSet.has(result.productId),
  );
  const candidateProductIds = candidateResults.map(
    (result) => result.productId,
  );
  const snapshots: ProductCatalogSnapshot[] =
    (await config.catalogAdapter?.getSnapshotsByIds(candidateProductIds)) ??
    candidateResults.map((result) => ({
      productId: result.payload.productId,
      name: result.payload.name,
      slug: result.payload.slug,
      price: result.payload.price,
      discountPrice: result.payload.discountPrice,
      stock: result.payload.stock,
      category: result.payload.category,
      searchMetadata: {
        categoryPath: result.payload.categoryPath,
        normalizedSpecs: result.payload.normalizedSpecs,
      },
      isPublished: result.payload.isPublished,
      isArchived: result.payload.isArchived,
    }));
  throwIfAborted(config.abortSignal);
  const snapshotById = new Map<string, ProductCatalogSnapshot>(
    snapshots.map((snapshot) => [snapshot.productId, snapshot] as const),
  );
  const filteredResults = candidateResults.filter((result) => {
    const snapshot = snapshotById.get(result.productId);
    return snapshot
      ? resultSatisfiesVisibleConstraints(result, snapshot, visibleConstraints)
      : false;
  });
  const constrainedResults = sortResultsByRequestedPrice(
    uniqueResultsByProductId(filteredResults),
    snapshotById,
    priceSort,
  ).slice(0, cardLimit);
  const freshProductCards: ProductAdviceCard[] = constrainedResults.map(
    (result) => {
      const snapshot = snapshotById.get(result.productId)!;
      return toProductCard(result, snapshot);
    },
  );
  const productCards = productCardsForConsultationMode({
    consultationMode,
    priorRecommendations,
    freshProductCards,
    maxCards: recommendationConfig.maxLimit,
  });
  const productIds = productCards.map((card) => card.productId);
  throwIfAborted(config.abortSignal);

  if (productCards.length === 0) {
    return {
      intent: 'PRODUCT_ADVICE',
      nodeName: 'product_advice',
      text: minimalNoResultText(retrieval),
      metadata: {
        productCards,
        followUpQuestions,
        retrievalQuery: retrieval.query,
        retrieval_query: retrieval.effectiveQuery ?? searchQuery,
        crag_retry: retrieval.cragRetry ?? retrieval.crag_retry,
        productIds,
        active_subgraph: 'sales',
        tool_calls: buildProductToolCalls(retrieval, productIds),
        tool_results: {
          search_products: {
            retrieval_query: retrieval.effectiveQuery ?? searchQuery,
            crag_retry: retrieval.cragRetry ?? retrieval.crag_retry,
            productIds,
          },
          get_product_snapshot: {
            productIds,
            count: 0,
          },
        },
        ...rewriteTraceMetadata(retrieval),
        requested_recommendation_limit: requestedRecommendationLimit,
        applied_recommendation_limit: cardLimit,
        price_sort: priceSort,
        product_card_count: productCards.length,
        ...continuityMetadata({
          mode: consultationMode,
          priorRecommendations,
          comparedProductIds: productIds,
          preferenceDelta,
        }),
        llmComposed: false,
        llmComposeStatus: 'skipped',
        llmComposeFallbackReason: 'no_product_cards',
      },
    };
  }

  const advice = await composeGroundedProductAdviceText(config, {
    userText: responseUserText,
    productCards,
    followUpQuestions,
    priorRecommendations,
    preferenceDelta,
    consultationMode,
  });

  if (
    roomId &&
    productCards.length > 0 &&
    (consultationMode !== 'refinement' || advice.llmComposed)
  ) {
    await config.sessionService?.saveRecommendationLedger(roomId, productCards);
    throwIfAborted(config.abortSignal);
  }
  return {
    intent: 'PRODUCT_ADVICE',
    nodeName: 'product_advice',
    text: advice.text,
    metadata: {
      productCards,
      followUpQuestions,
      retrievalQuery: retrieval.query,
      retrieval_query: retrieval.effectiveQuery ?? searchQuery,
      crag_retry: retrieval.cragRetry ?? retrieval.crag_retry,
      productIds,
      active_subgraph: 'sales',
      tool_calls: buildProductToolCalls(retrieval, productIds),
      tool_results: {
        search_products: {
          retrieval_query: retrieval.effectiveQuery ?? searchQuery,
          crag_retry: retrieval.cragRetry ?? retrieval.crag_retry,
          productIds,
        },
        get_product_snapshot: {
          productIds,
          count: productCards.length,
        },
      },
      ...rewriteTraceMetadata(retrieval),
      requested_recommendation_limit: requestedRecommendationLimit,
      applied_recommendation_limit: cardLimit,
      price_sort: priceSort,
      product_card_count: productCards.length,
      ...continuityMetadata({
        mode: consultationMode,
        priorRecommendations,
        comparedProductIds: productIds,
        preferenceDelta,
      }),
      llmComposed: advice.llmComposed,
      llmComposeStatus: advice.llmComposeStatus,
      ...(advice.llmComposeFallbackReason
        ? { llmComposeFallbackReason: advice.llmComposeFallbackReason }
        : {}),
    },
  };
}

function buildClarificationText(followUpQuestions: string[]): string {
  return followUpQuestions.join(' ');
}

async function composeProductClarificationText(
  config: ProductAdviceConfig,
  input: {
    userText: string;
    followUpQuestions: string[];
  },
): Promise<ProductAdviceComposeMetadata> {
  try {
    if (!config.responseComposer) {
      return {
        text: buildClarificationText(input.followUpQuestions),
        llmComposed: false,
        llmComposeStatus: 'fallback',
        llmComposeFallbackReason: 'composer_unavailable',
      };
    }
    const controller = new AbortController();
    const composeSignal = combineAbortSignals(
      config.abortSignal,
      controller.signal,
    );
    const composePromise = config.responseComposer.composeProductClarification({
      ...input,
      promptContext: config.promptContext,
      signal: composeSignal,
    });
    const text = await withTimeout(
      composePromise,
      config.composeTimeoutMs ?? PRODUCT_ADVICE_COMPOSE_TIMEOUT_MS,
      () => controller.abort(),
    );
    const usableText = isCompleteAdviceText(text) ? text : null;
    return {
      text: usableText ?? buildClarificationText(input.followUpQuestions),
      llmComposed: Boolean(usableText),
      llmComposeStatus: usableText ? 'used' : 'fallback',
      ...(usableText
        ? {}
        : {
            llmComposeFallbackReason: text
              ? 'unusable_composed_text'
              : 'composer_returned_empty',
          }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return {
      text: buildClarificationText(input.followUpQuestions),
      llmComposed: false,
      llmComposeStatus: 'fallback',
      llmComposeFallbackReason:
        message === 'product_advice_compose_timeout'
          ? 'composer_timeout'
          : 'composer_failed',
    };
  }
}

async function composeGroundedProductAdviceText(
  config: ProductAdviceConfig,
  input: {
    userText: string;
    productCards: ProductAdviceCard[];
    followUpQuestions: string[];
    priorRecommendations?: AssistantPriorRecommendationContext[];
    preferenceDelta?: string;
    consultationMode?: AssistantProductConsultationMode;
    slotCoverage?: ProductAdviceSlotCoverage;
  },
): Promise<ProductAdviceComposeMetadata> {
  const composeResult = await composeProductAdviceText(config, input);
  const composedText = composeResult.text;
  const fallbackReason = validateComposedAdviceText(composedText, input);
  const usableComposedText = fallbackReason ? null : composedText;

  if (usableComposedText) {
    return {
      text: withMissingSlotGapNotice(usableComposedText, input.slotCoverage),
      llmComposed: true,
      llmComposeStatus: 'used',
    };
  }

  const effectiveFallbackReason =
    composeResult.fallbackReason ?? fallbackReason ?? 'composer_unavailable';
  return {
    text: withMissingSlotGapNotice(
      productAdviceFallbackText(input),
      input.slotCoverage,
    ),
    llmComposed: false,
    llmComposeStatus: 'fallback',
    llmComposeFallbackReason: effectiveFallbackReason,
  };
}

function isGroundedComposedAdviceText(
  text: string,
  input: {
    userText: string;
    productCards: ProductAdviceCard[];
  },
): boolean {
  if (!isWarrantyQuestion(input.userText)) return true;
  if (hasExplicitWarrantyFact(input.productCards)) return true;
  return !hasUnsupportedWarrantyClaim(text);
}

function isWarrantyQuestion(text: string): boolean {
  return /bao hanh|warranty|chinh sach/.test(normalizeAdviceIntentText(text));
}

function hasExplicitWarrantyFact(productCards: ProductAdviceCard[]): boolean {
  return productCards.some((card) => {
    const topLevelWarranty = (card as { warranty?: unknown }).warranty;
    if (topLevelWarranty !== undefined && topLevelWarranty !== null)
      return true;

    return /bao hanh|warranty/.test(
      normalizeAdviceIntentText(JSON.stringify(card.specs ?? {})),
    );
  });
}

function hasUnsupportedWarrantyClaim(text: string): boolean {
  const normalized = normalizeAdviceIntentText(text);
  if (
    /khong co|khong thay|chua co|chua thay|catalog.*khong|catalog.*chua/.test(
      normalized,
    )
  ) {
    return false;
  }
  return /bao hanh|warranty|chinh hang|nha san xuat|\b\d{1,2}\s*(thang|nam)\b/.test(
    normalized,
  );
}

async function composeProductAdviceText(
  config: ProductAdviceConfig,
  input: {
    userText: string;
    productCards: ProductAdviceCard[];
    followUpQuestions: string[];
    priorRecommendations?: AssistantPriorRecommendationContext[];
    preferenceDelta?: string;
    consultationMode?: AssistantProductConsultationMode;
    slotCoverage?: ProductAdviceSlotCoverage;
  },
): Promise<ProductAdviceComposeResult> {
  try {
    if (!config.responseComposer) {
      return {
        text: null,
        fallbackReason: 'composer_unavailable',
      };
    }
    const controller = new AbortController();
    const composeSignal = combineAbortSignals(
      config.abortSignal,
      controller.signal,
    );
    const composePromise = config.responseComposer.composeProductAdvice({
      ...input,
      promptContext: config.promptContext,
      signal: composeSignal,
    });
    const text = await withTimeout(
      composePromise,
      config.composeTimeoutMs ?? PRODUCT_ADVICE_COMPOSE_TIMEOUT_MS,
      () => controller.abort(),
    );
    return {
      text,
      fallbackReason: text ? undefined : 'composer_returned_empty',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return {
      text: null,
      fallbackReason:
        message === 'product_advice_compose_timeout'
          ? 'composer_timeout'
          : 'composer_failed',
    };
  }
}

function validateComposedAdviceText(
  text: string | null,
  input: {
    userText: string;
    productCards: ProductAdviceCard[];
  },
): string | undefined {
  if (!isCompleteAdviceText(text)) return 'incomplete_composed_text';
  if (hasConflictingProductCountClaim(text, input.productCards.length)) {
    return 'count_claim_mismatch';
  }
  if (
    isWarrantyQuestion(input.userText) &&
    !hasExplicitWarrantyFact(input.productCards) &&
    hasUnsupportedWarrantyClaim(text)
  ) {
    return 'unsupported_warranty_claim';
  }
  return undefined;
}

function isCompleteAdviceText(text: string | null): text is string {
  if (!text) return false;
  return /[.!?…]$/.test(text.trim());
}

function hasConflictingProductCountClaim(
  text: string,
  productCardCount: number,
): boolean {
  const normalized = normalizeAdviceIntentText(text);
  const claimedCounts = extractProductCountClaims(normalized);
  return claimedCounts.some(
    (claim) =>
      claim.count !== productCardCount &&
      isExhaustiveProductCountClaim(normalized, claim.index),
  );
}

function extractProductCountClaims(
  normalizedText: string,
): Array<{ count: number; index: number }> {
  if (!normalizedText) return [];

  const claims: Array<{ count: number; index: number }> = [];
  const numericPattern = new RegExp(
    `\\b(\\d{1,2})\\s+(?:${PRODUCT_COUNT_NOUN_PATTERN})\\b`,
    'g',
  );
  let numericMatch: RegExpExecArray | null;
  while ((numericMatch = numericPattern.exec(normalizedText)) !== null) {
    const count = Number(numericMatch[1]);
    if (Number.isInteger(count)) {
      claims.push({ count, index: numericMatch.index });
    }
  }

  const wordPattern = new RegExp(
    `\\b(${PRODUCT_COUNT_WORD_PATTERN})\\s+(?:${PRODUCT_COUNT_NOUN_PATTERN})\\b`,
    'g',
  );
  let wordMatch: RegExpExecArray | null;
  while ((wordMatch = wordPattern.exec(normalizedText)) !== null) {
    const count = PRODUCT_COUNT_WORDS[wordMatch[1]];
    if (Number.isInteger(count)) {
      claims.push({ count, index: wordMatch.index });
    }
  }

  return claims;
}

function isExhaustiveProductCountClaim(
  normalizedText: string,
  claimIndex: number,
): boolean {
  const context = normalizedText.slice(
    Math.max(0, claimIndex - 40),
    claimIndex + 80,
  );
  return /tim thay|hien co|co tong|tong cong|tat ca|gom|bao gom|duoc gui/.test(
    context,
  );
}
function minimalProductCardsText(_productCards: ProductAdviceCard[]): string {
  return 'Mình đã gửi các lựa chọn khớp nhất vào thẻ sản phẩm bên dưới để bạn xem nhanh.';
}

function productAdviceFallbackText(input: {
  productCards: ProductAdviceCard[];
  priorRecommendations?: AssistantPriorRecommendationContext[];
  preferenceDelta?: string;
  consultationMode?: AssistantProductConsultationMode;
  slotCoverage?: ProductAdviceSlotCoverage;
}): string {
  if (input.consultationMode === 'refinement') {
    return continuityAwareRefinementFallbackText(input);
  }

  const cardSummaries = productCardFactSummaries(input.productCards);
  if (cardSummaries.length === 0)
    return minimalProductCardsText(input.productCards);

  const leadSummary = cardSummaries[0];
  const comparisonText = cardSummaries.slice(1, 3).join('; ');
  const suffix = comparisonText
    ? ` Bạn có thể so thêm ${comparisonText} trong các thẻ sản phẩm bên dưới.`
    : ' Bạn có thể mở thẻ sản phẩm bên dưới để xem chi tiết cấu hình, giá và tình trạng hàng.';
  const gapText =
    input.consultationMode === 'combo_advice'
      ? missingSlotGapNotice(input.slotCoverage)
      : '';

  switch (input.consultationMode) {
    case 'more_options':
      return `Mình đã lọc thêm lựa chọn khác ngoài nhóm vừa tư vấn, nổi bật là ${leadSummary}.${suffix}`;
    case 'price_sort':
      return `Mình đã sắp xếp lại nhóm đã tư vấn theo yêu cầu, bắt đầu với ${leadSummary}.${suffix}`;
    case 'combo_advice':
      return `Mình đã gom các lựa chọn theo từng nhóm nhu cầu, trong đó có ${leadSummary}.${suffix}${gapText}`;
    case 'initial_advice':
    default:
      return `Mình tìm thấy lựa chọn phù hợp để bạn cân nhắc, nổi bật là ${leadSummary}.${suffix}`;
  }
}

function withMissingSlotGapNotice(
  text: string,
  slotCoverage?: ProductAdviceSlotCoverage,
): string {
  const notice = missingSlotGapNotice(slotCoverage);
  if (!notice) return text;
  const normalizedText = normalizeAdviceIntentText(text);
  const alreadyMentionsCatalogGap =
    /catalog.*(chua|khong)|chua co lua chon phu hop|khong co lua chon phu hop/.test(
      normalizedText,
    );
  const mentionsEveryMissingSlot = (slotCoverage?.missingSlots ?? []).every(
    (slot) =>
      normalizeAdviceIntentText(slotGapLabel(slot))
        .split('/')
        .some((label) => normalizedText.includes(label.trim())),
  );
  return alreadyMentionsCatalogGap && mentionsEveryMissingSlot
    ? text
    : `${text}${notice}`;
}

function missingSlotGapNotice(
  slotCoverage?: ProductAdviceSlotCoverage,
): string {
  const missingSlots = slotCoverage?.missingSlots ?? [];
  if (missingSlots.length === 0) return '';
  const labels = uniqueAdviceStrings(missingSlots.map(slotGapLabel));
  if (labels.length === 0) return '';
  const criticalDesktopGap = missingSlots.includes('desktop_pc')
    ? ' Mình không thay PC bộ bằng linh kiện rời hoặc sản phẩm khác.'
    : '';
  return ` Hiện catalog chưa có lựa chọn phù hợp cho ${labels.join(', ')}.${criticalDesktopGap}`;
}

function slotGapLabel(slot: string): string {
  switch (slot) {
    case 'desktop_pc':
      return 'PC bộ/desktop PC';
    case 'desk':
      return 'bàn';
    case 'chair':
      return 'ghế';
    case 'monitor':
      return 'màn hình';
    case 'keyboard':
      return 'bàn phím';
    case 'mouse':
      return 'chuột';
    case 'microphone':
      return 'microphone';
    case 'webcam':
      return 'webcam';
    case 'lighting':
      return 'đèn livestream';
    case 'headset':
      return 'tai nghe';
    default:
      return slot.replace(/_/g, ' ');
  }
}

function continuityAwareRefinementFallbackText(input: {
  productCards: ProductAdviceCard[];
  priorRecommendations?: AssistantPriorRecommendationContext[];
  preferenceDelta?: string;
}): string {
  const priorRecommendations = input.priorRecommendations ?? [];
  const priorIds = new Set(priorRecommendations.map((item) => item.productId));
  const priorLead = priorRecommendations[0];
  const currentCandidates = input.productCards.filter(
    (card) => !priorIds.has(card.productId),
  );
  const comparisonNames = listProductNames(
    currentCandidates.length > 0
      ? currentCandidates
      : input.productCards.slice(1),
  );
  const priorLeadText = priorLead?.name
    ? `Mình vẫn giữ ${priorLead.name} trong nhóm so sánh vì đây là lựa chọn đã tư vấn trước đó`
    : 'Mình vẫn giữ các lựa chọn đã tư vấn trước đó trong nhóm so sánh';
  const preferenceText = input.preferenceDelta
    ? ` theo ưu tiên mới "${input.preferenceDelta}"`
    : ' theo ưu tiên mới của bạn';
  const comparisonText = comparisonNames
    ? `, đồng thời đưa thêm ${comparisonNames} để bạn cân độ phù hợp, giá và tình trạng hàng.`
    : ', rồi cân lại độ phù hợp, giá và tình trạng hàng trên từng thẻ sản phẩm.';

  return `${priorLeadText}${preferenceText}${comparisonText} Với tiêu chí ưu tiên mới, bạn nên xem kỹ các cấu hình chính, mức giá và tình trạng hàng trong từng thẻ trước khi chốt mẫu phù hợp nhất.`;
}

function productCardFactSummaries(productCards: ProductAdviceCard[]): string[] {
  return productCards
    .map((card) => {
      const facts = [
        card.name,
        formatProductCardPrice(card),
        typeof card.stock === 'number'
          ? card.stock > 0
            ? `còn ${card.stock} sản phẩm`
            : 'đang hết hàng'
          : undefined,
        card.reasons?.find(Boolean),
      ].filter((fact): fact is string => Boolean(fact));
      return facts.slice(0, 3).join(' - ');
    })
    .filter(Boolean);
}

function formatProductCardPrice(card: ProductAdviceCard): string | undefined {
  const price = card.discountPrice ?? card.price;
  return typeof price === 'number' && Number.isFinite(price)
    ? `${price.toLocaleString('vi-VN')}đ`
    : undefined;
}

function listProductNames(
  productCards: ProductAdviceCard[],
  limit = 2,
): string {
  const names = productCards
    .map((card) => card.name)
    .filter((name): name is string => Boolean(name))
    .slice(0, limit);
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} và ${names[names.length - 1]}`;
}

function productCardsForConsultationMode(input: {
  consultationMode: AssistantProductConsultationMode;
  priorRecommendations: AssistantPriorRecommendationContext[];
  freshProductCards: ProductAdviceCard[];
  maxCards: number;
}): ProductAdviceCard[] {
  if (input.consultationMode !== 'refinement') return input.freshProductCards;
  return uniqueProductCardsByProductId([
    ...input.priorRecommendations.map(productCardFromPriorRecommendation),
    ...input.freshProductCards,
  ]).slice(0, input.maxCards);
}

function productCardFromPriorRecommendation(
  item: AssistantPriorRecommendationContext,
): ProductAdviceCard {
  const stock = typeof item.stock === 'number' ? item.stock : undefined;
  const addable = stock === undefined || stock > 0;
  const effectivePrice = item.discountPrice ?? item.price;
  return {
    productId: item.productId,
    name: item.name,
    slug: item.slug,
    detailHref: item.slug
      ? `/products/${item.slug}`
      : `/products/${item.productId}`,
    price: item.price,
    discountPrice: item.discountPrice,
    stock,
    reasons: uniqueAdviceStrings([
      ...(item.reasons ?? []),
      item.specsSummary,
      item.category ? `Danh mục: ${item.category}` : undefined,
      'Nằm trong danh sách vừa tư vấn.',
    ]),
    availability: {
      status: addable ? 'available' : 'out_of_stock',
      addable,
    },
    actionPayload: {
      productId: item.productId,
      actions: ['VIEW_PRODUCT', ...(effectivePrice ? ['ADD_TO_CART'] : [])],
    },
    specs:
      item.specs ?? (item.specsSummary ? { summary: item.specsSummary } : {}),
  };
}

function sanitizeCustomerFacingRequest(text: string): string {
  return text
    .replace(/\bcho\s+(?:tao|tui|tớ)\b/giu, 'cho mình')
    .replace(/\b(?:tao|tui|tớ)\s+(cần|muốn|đang)\b/giu, 'mình $1')
    .replace(/\b(?:tao|tui|tớ)\b/giu, 'mình')
    .replace(/\bđê\b/giu, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;!?])/g, '$1')
    .trim();
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
      reject(new Error('product_advice_compose_timeout'));
    }, timeoutMs);
  });

  return Promise.race([
    promise.finally(() => {
      if (timeout) clearTimeout(timeout);
    }),
    timeoutPromise,
  ]);
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw new Error('product_advice_aborted');
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

function productSearchText(state: ProductAdviceState): string {
  return expandPerformanceLaptopSearchText(productCustomerText(state));
}

function isContextualSetupProductAdvice(state: ProductAdviceState): boolean {
  const text = [
    state.userText,
    asString(state.intentPlan?.contextualUserText),
    asString(state.parsedEntities?.contextualUserText),
  ]
    .filter(Boolean)
    .join(' ');
  return (
    isSetupOrComboProductAdvice(text) ||
    comboGroupsFromIntentPrimitives(text).length > 1
  );
}

function setupClarificationQuestionsForState(
  state: ProductAdviceState,
  contextualSetupAdvice: boolean,
): string[] {
  const currentText = state.userText;
  const normalizedCurrent = normalizeAdviceIntentText(currentText);
  const normalizedContext = normalizeAdviceIntentText(
    [
      currentText,
      asString(state.intentPlan?.contextualUserText),
      asString(state.parsedEntities?.contextualUserText),
    ]
      .filter(Boolean)
      .join(' '),
  );
  const explicitCurrentSlotCount = explicitSetupSlotCount(normalizedCurrent);
  const currentHasBudget = hasSetupBudgetSignal(normalizedCurrent);
  const contextHasBudget = hasSetupBudgetSignal(normalizedContext);
  const hasMultipleCurrentSlots = explicitCurrentSlotCount >= 2;
  const broadLivestreamSetup =
    /\b(setup|set up|goc|combo|tron bo|ca bo)\b/.test(normalizedCurrent) &&
    /\b(livestream|streaming|streamer)\b/.test(normalizedCurrent) &&
    !hasMultipleCurrentSlots &&
    !currentHasBudget;

  if (broadLivestreamSetup) return SETUP_ADVICE_FOLLOW_UP_QUESTIONS;

  const asksPcCorrection =
    contextualSetupAdvice &&
    /\b(pc|desktop|may bo|may tinh de ban|may tinh ban)\b/.test(
      normalizedCurrent,
    ) &&
    !hasMultipleCurrentSlots &&
    !contextHasBudget &&
    !asksForPcComponentsOrCustomBuild(normalizedCurrent);

  return asksPcCorrection ? SETUP_PC_CLARIFICATION_QUESTIONS : [];
}

function explicitSetupSlotCount(normalizedText: string): number {
  const slots = new Set<string>();
  if (/\b(laptop|notebook|may tinh xach tay)\b/.test(normalizedText)) {
    slots.add('laptop');
  }
  if (
    /\b(pc|desktop|may bo|may tinh de ban|may tinh ban)\b/.test(normalizedText)
  ) {
    slots.add('desktop_pc');
  }
  if (/\b(ban ghe|desk|ban gaming|ban lam viec)\b/.test(normalizedText)) {
    slots.add('desk');
  }
  if (/\b(ghe|chair|ghe gaming|ghe cong thai hoc)\b/.test(normalizedText)) {
    slots.add('chair');
  }
  if (/\b(micro|mic|microphone|thu am)\b/.test(normalizedText)) {
    slots.add('microphone');
  }
  if (/\b(webcam|camera)\b/.test(normalizedText)) slots.add('webcam');
  if (/\b(den|lighting|led)\b/.test(normalizedText)) slots.add('lighting');
  if (/\b(man hinh|monitor)\b/.test(normalizedText)) slots.add('monitor');
  return slots.size;
}
function hasSetupBudgetSignal(normalizedText: string): boolean {
  return /\b\d{1,3}\s*(?:tr|trieu|m|k|ngan|nghin|vnd|d|dong)\b/.test(
    normalizedText,
  );
}

function asksForPcComponentsOrCustomBuild(normalizedText: string): boolean {
  return /\b(build|custom|linh kien|lap rap|rap may|cpu|ram|mainboard|vga|gpu|ssd|hdd|case|psu|nguon|tan nhiet)\b/.test(
    normalizedText,
  );
}

function productCustomerText(state: ProductAdviceState): string {
  const productCategory = asString(state.parsedEntities?.productCategory);
  const requestedMoreOptions =
    state.intentPlan?.requestedMoreOptions === true ||
    state.parsedEntities?.requestedMoreOptions === true ||
    state.requestedMoreOptions === true;
  const contextualUserText = asString(state.intentPlan?.contextualUserText);
  if (contextualUserText) {
    return ensureProductCategorySearchText(
      requestedMoreOptions
        ? stripMoreOptionsContinuationPhrases(contextualUserText)
        : contextualUserText,
      productCategory,
    );
  }

  const entityContextualUserText = asString(
    state.parsedEntities?.contextualUserText,
  );
  if (entityContextualUserText) {
    return ensureProductCategorySearchText(
      requestedMoreOptions
        ? stripMoreOptionsContinuationPhrases(entityContextualUserText)
        : entityContextualUserText,
      productCategory,
    );
  }

  if (productCategory && !mentionsCatalogProduct(state.userText)) {
    return `${productCategory} ${state.userText}`.trim();
  }

  return state.userText;
}

function stripMoreOptionsContinuationPhrases(text: string): string {
  const cleaned = text
    .replace(
      /\b(?:co|có)\s+(?:may|máy|mau|mẫu|san pham|sản phẩm|lua chon|lựa chọn)?\s*(?:khac|khác)\s*(?:nua|nữa)?\s*(?:khong|không|ko|k)?\b/giu,
      ' ',
    )
    .replace(
      /\b(?:may|máy|mau|mẫu|san pham|sản phẩm|lua chon|lựa chọn)\s+(?:khac|khác)(?:\s+(?:nua|nữa))?\b/giu,
      ' ',
    )
    .replace(/[ ,.;]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || text;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

async function fastSetupSlotFollowUpResponse(input: {
  state: ProductAdviceState;
  config: ProductAdviceConfig;
  productRetriever: ProductRetriever;
  groups: Array<'desk' | 'chair'>;
  roomId?: string;
  cardLimit: number;
}): Promise<ProductAdviceResult> {
  const query = setupSlotFollowUpQuery(input.state.userText, input.groups);
  const perGroupTopK = Math.min(3, Math.max(1, input.cardLimit));
  const retrievals = await Promise.all(
    input.groups.map((group) =>
      searchSetupSlotWithinBudget(
        input.productRetriever,
        group,
        query,
        perGroupTopK,
        input.config.abortSignal,
      ),
    ),
  );
  throwIfAborted(input.config.abortSignal);

  const candidatesByGroup = new Map(
    retrievals.map((entry) => [entry.group, entry.results] as const),
  );
  const candidateResults = uniqueResultsByProductId(
    retrievals.flatMap((entry) => entry.results),
  );
  const candidateProductIds = candidateResults.map((result) => result.productId);
  const fallbackSnapshots = candidateResults.map(snapshotFromResult);
  const snapshots: ProductCatalogSnapshot[] = candidateProductIds.length
    ? await withTimeout(
        input.config.catalogAdapter?.getSnapshotsByIds(candidateProductIds) ??
          Promise.resolve(fallbackSnapshots),
        SETUP_SLOT_SNAPSHOT_TIMEOUT_MS,
        undefined,
      ).catch(() => fallbackSnapshots)
    : [];
  throwIfAborted(input.config.abortSignal);

  const snapshotById = new Map<string, ProductCatalogSnapshot>(
    snapshots.map((snapshot) => [snapshot.productId, snapshot] as const),
  );
  const productGroups: ProductAdviceProductGroup[] =
    uniqueProductGroupsByProductId(
      input.groups
        .map((group) => ({
          groupId: group,
          label: slotGapLabel(group),
          productCards: (candidatesByGroup.get(group) ?? [])
            .filter((result) => {
              const snapshot = snapshotById.get(result.productId);
              if (!snapshot || Number(snapshot.stock ?? 0) <= 0) return false;
              return resultSatisfiesVisibleConstraints(result, snapshot, {
                categoryHints: [group],
                inStockOnly: true,
              });
            })
            .slice(0, perGroupTopK)
            .map((result) =>
              toProductCard(result, snapshotById.get(result.productId)!),
            ),
        }))
        .filter((group) => group.productCards.length > 0),
    );
  const productCards = productGroups.flatMap((group) => group.productCards);
  const productIds = productCards.map((card) => card.productId);
  const slotCoverage: ProductAdviceSlotCoverage = {
    requestedSlots: input.groups,
    coveredSlots: productGroups.map((group) => group.groupId),
    missingSlots: input.groups.filter(
      (group) => !productGroups.some((productGroup) => productGroup.groupId === group),
    ),
  };
  const groupCoverage = groupCoverageFromSlotCoverage(slotCoverage);
  const rewrite = skippedRewriteMetadata(query, 'setup_slot_followup_fast_path');

  if (input.roomId && productCards.length > 0) {
    await input.config.sessionService?.saveRecommendationLedger(
      input.roomId,
      productCards,
    );
    throwIfAborted(input.config.abortSignal);
  }

  return {
    intent: 'PRODUCT_ADVICE',
    nodeName: 'product_advice',
    text: setupSlotFollowUpText(productCards, slotCoverage),
    metadata: {
      productCards,
      productGroups,
      followUpQuestions: [],
      retrievalQuery: {
        original: query,
        expanded: [],
        expandedText: query,
        constraints: { categoryHints: input.groups, inStockOnly: true },
      },
      retrieval_query: query,
      productIds,
      group_coverage: groupCoverage,
      setup_slot_coverage: slotCoverage,
      combo_group_count: input.groups.length,
      active_subgraph: 'sales',
      tool_calls: buildProductToolCalls({ effectiveQuery: query }, productIds),
      tool_results: {
        search_products: {
          retrieval_query: query,
          productIds,
        },
        get_product_snapshot: {
          productIds,
          count: productCards.length,
        },
      },
      ...rewrite.metadata,
      requested_recommendation_limit: null,
      applied_recommendation_limit: productCards.length,
      product_card_count: productCards.length,
      consultationMode: 'combo_advice',
      comparedProductIds: productIds,
      llmComposed: false,
      llmComposeStatus: 'skipped',
      llmComposeFallbackReason: 'setup_slot_followup_fast_path',
    },
  };
}

async function searchSetupSlotWithinBudget(
  productRetriever: ProductRetriever,
  group: 'desk' | 'chair',
  query: string,
  topK: number,
  signal?: AbortSignal,
): Promise<{ group: 'desk' | 'chair'; results: RerankedProductCandidate[] }> {
  if (signal?.aborted) return { group, results: [] };
  const slotQuery = `${query} ${slotSearchTerms(group)}`.trim();
  const searchPromise = productRetriever
    .search(slotQuery, {
      topK,
      hardConstraints: { categoryHints: [group], inStockOnly: true },
      pipeline: 'phase-09.2-baseline',
    })
    .then((retrieval) => ({ group, results: retrieval.results }))
    .catch(() => ({ group, results: [] }));

  return withTimeout(
    searchPromise,
    SETUP_SLOT_FOLLOW_UP_TIMEOUT_MS,
    undefined,
  ).catch(() => ({ group, results: [] }));
}

function setupSlotFollowUpGroupsForState(
  state: ProductAdviceState,
  contextualSetupAdvice: boolean,
): Array<'desk' | 'chair'> {
  if (!contextualSetupAdvice) return [];
  const reason =
    asString(state.intentPlan?.contextResolutionReason) ??
    asString(state.parsedEntities?.contextResolutionReason);
  const setupContextText = [
    asString(state.intentPlan?.contextualUserText),
    asString(state.parsedEntities?.contextualUserText),
  ]
    .filter(Boolean)
    .join(' ');
  const hasSetupContext =
    reason === 'shopping_setup_continuation' ||
    isSetupOrComboProductAdvice(setupContextText) ||
    /\b(livestream|streaming|streamer)\b/.test(
      normalizeAdviceIntentText(setupContextText),
    );
  if (!hasSetupContext) return [];

  const normalizedCurrent = normalizeAdviceIntentText(state.userText);
  if (!normalizedCurrent || isInformationalDefinitionRequest(normalizedCurrent)) {
    return [];
  }
  const currentSlots = explicitRequestedSetupSlots(state.userText).filter(
    (slot): slot is 'desk' | 'chair' => slot === 'desk' || slot === 'chair',
  );
  if (currentSlots.length === 0) return [];
  const allCurrentSlots = explicitRequestedSetupSlots(state.userText);
  if (allCurrentSlots.some((slot) => slot !== 'desk' && slot !== 'chair')) {
    return [];
  }
  return currentSlots;
}

function setupSlotFollowUpQuery(
  userText: string,
  groups: Array<'desk' | 'chair'>,
): string {
  const slotText = groups.map(slotGapLabel).join(' ');
  return `${slotText} setup livestream ${userText}`
    .replace(/\s+/g, ' ')
    .trim();
}

function slotSearchTerms(group: 'desk' | 'chair'): string {
  return group === 'desk'
    ? 'ban lam viec ban gaming desk'
    : 'ghe gaming ghe cong thai hoc chair';
}

function setupSlotFollowUpText(
  productCards: ProductAdviceCard[],
  slotCoverage: ProductAdviceSlotCoverage,
): string {
  const gapText = missingSlotGapNotice(slotCoverage);
  if (productCards.length === 0) {
    const labels = slotCoverage.requestedSlots.map(slotGapLabel).join(', ');
    return `Hiện catalog chưa có lựa chọn phù hợp cho ${labels} trong setup vừa rồi.${gapText}`;
  }

  const summaries = productCardFactSummaries(productCards).slice(0, 3);
  const summaryText = summaries.length
    ? ` Nổi bật là ${summaries.join('; ')}.`
    : '';
  return `Mình lọc riêng phần ${slotCoverage.requestedSlots
    .map(slotGapLabel)
    .join('/')} trong setup vừa rồi và gửi thẻ sản phẩm bên dưới.${summaryText}${gapText}`;
}

function slotCoverageFromRetrieval(
  retrieval: ProductRetrievalResult,
  productGroups: ProductAdviceProductGroup[],
): ProductAdviceSlotCoverage {
  const coveredByCards = new Set(productGroups.map((group) => group.groupId));
  const requestedSlots = uniqueAdviceStrings([
    ...(retrieval.groupCoverage?.expectedGroups ?? []),
    ...(retrieval.rewrite?.comboGroups ?? []),
  ]);
  const coveredSlots = Array.from(coveredByCards).filter((slot) =>
    requestedSlots.includes(slot),
  );
  const missingSlots = requestedSlots.filter(
    (slot) => !coveredByCards.has(slot),
  );
  return { requestedSlots, coveredSlots, missingSlots };
}

function gateComboProductGroups(
  productGroups: ProductAdviceProductGroup[],
  retrieval: ProductRetrievalResult,
  query: string,
): ProductAdviceProductGroup[] {
  const explicitSlots = explicitRequestedSetupSlots(query).filter((slot) =>
    (retrieval.groupCoverage?.expectedGroups ?? []).includes(slot),
  );
  if (explicitSlots.length === 0) return productGroups;

  const coveredSlots = new Set(productGroups.map((group) => group.groupId));
  const missingExplicitSlots = explicitSlots.filter(
    (slot) => !coveredSlots.has(slot),
  );
  if (missingExplicitSlots.length === 0) return productGroups;

  return productGroups.filter((group) => explicitSlots.includes(group.groupId));
}

function explicitRequestedSetupSlots(query: string): string[] {
  const normalized = normalizeSetupSlotText(query);
  const slots: string[] = [];
  if (/\b(laptop|notebook|may tinh xach tay)\b/.test(normalized)) {
    slots.push('laptop');
  }
  if (/\b(pc|desktop|may bo|may tinh de ban|may tinh ban)\b/.test(normalized)) {
    slots.push('desktop_pc');
  }
  if (/\b(ban|ban ghe|desk|ban gaming|ban lam viec)\b/.test(normalized)) {
    slots.push('desk');
  }
  if (/\b(ghe|chair|ghe gaming|ghe cong thai hoc)\b/.test(normalized)) {
    slots.push('chair');
  }
  if (/\b(micro|mic|microphone|thu am)\b/.test(normalized)) {
    slots.push('microphone');
  }
  if (/\b(webcam|camera)\b/.test(normalized)) slots.push('webcam');
  if (/\b(den|lighting|led)\b/.test(normalized)) slots.push('lighting');
  if (/\b(man hinh|monitor)\b/.test(normalized)) slots.push('monitor');
  if (/\b(ban phim|keyboard)\b/.test(normalized)) slots.push('keyboard');
  if (/\b(tai nghe|headset|headphone|earphone|earbuds)\b/.test(normalized)) {
    slots.push('headset');
  }
  if (/\b(chuot|mouse)\b/.test(normalized)) slots.push('mouse');
  return uniqueAdviceStrings(slots);
}

function normalizeSetupSlotText(query: string): string {
  return query
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase();
}

function groupCoverageFromSlotCoverage(
  slotCoverage: ProductAdviceSlotCoverage,
): ProductGroupCoverage {
  const expectedGroups = slotCoverage.requestedSlots;
  const coveredGroups = slotCoverage.coveredSlots;
  return {
    expectedGroups,
    coveredGroups,
    missingGroups: slotCoverage.missingSlots,
    coverageRate:
      expectedGroups.length === 0
        ? 0
        : coveredGroups.length / expectedGroups.length,
  };
}

async function priorRecommendationsForMode(
  config: ProductAdviceConfig,
  roomId: string | undefined,
  mode: AssistantProductConsultationMode,
): Promise<AssistantPriorRecommendationContext[]> {
  if (!roomId || (mode !== 'refinement' && mode !== 'more_options')) {
    return [];
  }
  const ledger =
    (await config.sessionService?.getLastRecommendationLedger(roomId)) ?? [];
  return priorRecommendationsFromLedger(ledger);
}

function priorRecommendationsFromLedger(
  ledger: AssistantRecommendationLedgerEntry[],
): AssistantPriorRecommendationContext[] {
  return uniquePriorRecommendations(
    ledger.map((item) => ({
      rank: item.rank,
      productId: item.productId,
      name: item.name,
      slug: item.slug,
      category: item.category,
      price: item.price,
      discountPrice: item.discountPrice,
      stock: item.stock,
      specsSummary: item.specsSummary,
      specs: item.specsSummary ? { summary: item.specsSummary } : {},
      reasons: [
        item.specsSummary,
        item.category ? `Danh mục: ${item.category}` : undefined,
      ].filter((reason): reason is string => Boolean(reason)),
    })),
  );
}

function uniquePriorRecommendations(
  recommendations: AssistantPriorRecommendationContext[],
): AssistantPriorRecommendationContext[] {
  const seen = new Set<string>();
  return recommendations.filter((item) => {
    if (!item.productId || seen.has(item.productId)) return false;
    seen.add(item.productId);
    return true;
  });
}

function productConsultationModeFromState(
  state: ProductAdviceState,
  requestedMoreOptions: boolean,
  priorRecommendationSort: boolean | undefined,
): AssistantProductConsultationMode {
  if (requestedMoreOptions) return 'more_options';
  if (priorRecommendationSort) return 'price_sort';
  const reason =
    asString(state.intentPlan?.contextResolutionReason) ??
    asString(state.parsedEntities?.contextResolutionReason);
  return reason === 'shopping_constraint_continuation'
    ? 'refinement'
    : 'initial_advice';
}

function withoutCategoryConstraints(
  constraints: ProductRetrievalConstraints,
): ProductRetrievalConstraints {
  const cleaned = { ...constraints };
  delete cleaned.category;
  delete cleaned.categoryPath;
  delete cleaned.categoryHints;
  return cleaned;
}

function effectiveConsultationMode(
  requestedMode: AssistantProductConsultationMode,
  priorRecommendations: AssistantPriorRecommendationContext[],
): AssistantProductConsultationMode {
  return requestedMode === 'refinement' && priorRecommendations.length === 0
    ? 'initial_advice'
    : requestedMode;
}

function continuityMetadata(input: {
  mode: AssistantProductConsultationMode;
  priorRecommendations: AssistantPriorRecommendationContext[];
  comparedProductIds: string[];
  preferenceDelta?: string;
}): Pick<
  ProductAdviceResult['metadata'],
  | 'consultationMode'
  | 'priorRecommendationProductIds'
  | 'comparedProductIds'
  | 'recommendationContinuity'
> {
  const priorRecommendationProductIds = input.priorRecommendations.map(
    (item) => item.productId,
  );
  const includeContinuity =
    input.mode !== 'initial_advice' || priorRecommendationProductIds.length > 0;
  if (!includeContinuity) return {};

  return {
    consultationMode: input.mode,
    priorRecommendationProductIds,
    comparedProductIds: input.comparedProductIds,
    recommendationContinuity: {
      mode: input.mode,
      hasPriorRecommendations: priorRecommendationProductIds.length > 0,
      priorRecommendationProductIds,
      comparedProductIds: input.comparedProductIds,
      ...(input.preferenceDelta
        ? { preferenceDelta: input.preferenceDelta }
        : {}),
    },
  };
}

function productAdviceHardConstraints(
  state: ProductAdviceState,
  searchQuery: string,
): ProductRetrievalConstraints | undefined {
  const contextualUserText =
    asString(state.intentPlan?.contextualUserText) ??
    asString(state.parsedEntities?.contextualUserText);
  const sourceTexts = [state.userText, contextualUserText].filter(
    (text): text is string => Boolean(text),
  );
  const extractedConstraints = [
    ...sourceTexts,
    searchQuery,
  ].reduce<ProductRetrievalConstraints>(
    (constraints, text) =>
      mergeRetrievalConstraints(constraints, extractHardConstraints(text)),
    {},
  );
  const category =
    normalizedHardCategory(asString(state.parsedEntities?.productCategory)) ??
    explicitHardCategoryFromText(state.userText) ??
    (contextualUserText
      ? explicitHardCategoryFromText(contextualUserText)
      : undefined) ??
    explicitHardCategoryFromText(searchQuery);
  const categoryConstraints = category
    ? { categoryHints: [category] }
    : undefined;
  const merged = mergeRetrievalConstraints(
    extractedConstraints,
    categoryConstraints,
  );
  if (!category) delete merged.categoryHints;
  const cleaned = cleanProductAdviceHardConstraints(
    merged,
    sourceTexts.join(' '),
  );
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

function explicitHardCategoryFromText(text: string): string | undefined {
  return detectProductFamilyFromText(text);
}

function normalizedHardCategory(value?: string): string | undefined {
  return value ? detectProductFamilyFromText(value) : undefined;
}
function cleanProductAdviceHardConstraints(
  constraints: ProductRetrievalConstraints,
  explicitText: string,
): ProductRetrievalConstraints {
  const cleaned: ProductRetrievalConstraints = {};
  if (constraints.category) cleaned.category = constraints.category;
  if (constraints.categoryPath?.length)
    cleaned.categoryPath = constraints.categoryPath;
  if (constraints.categoryHints?.length)
    cleaned.categoryHints = constraints.categoryHints;
  const requiredSpecs = explicitRequiredSpecsOnly(
    constraints.requiredSpecs,
    explicitText,
  );
  const hasExplicitSpecs = Object.keys(requiredSpecs).length > 0;
  if (hasExplicitSpecs && typeof constraints.minPrice === 'number') {
    cleaned.minPrice = constraints.minPrice;
  }
  if (hasExplicitSpecs && typeof constraints.maxPrice === 'number') {
    cleaned.maxPrice = constraints.maxPrice;
  }
  if (constraints.inStockOnly === true) cleaned.inStockOnly = true;
  if (hasExplicitSpecs) cleaned.requiredSpecs = requiredSpecs;
  return cleaned;
}

function explicitRequiredSpecsOnly(
  specs: ProductRetrievalConstraints['requiredSpecs'],
  explicitText: string,
): NonNullable<ProductRetrievalConstraints['requiredSpecs']> {
  if (!specs) return {};
  const normalized = normalizeAdviceIntentText(explicitText);
  const explicit: NonNullable<ProductRetrievalConstraints['requiredSpecs']> =
    {};
  if (specs.ramGb && /\bram\s*\d{1,3}\s*gb\b/.test(normalized)) {
    explicit.ramGb = specs.ramGb;
  }
  if (specs.ssdGb && /\bssd\s*\d{3,4}\s*gb\b/.test(normalized)) {
    explicit.ssdGb = specs.ssdGb;
  }
  if (
    specs.gpu &&
    /\b(?:nvidia|gpu\s+nvidia|rtx\s*\d{3,4}|gtx\s*\d{3,4})\b/.test(normalized)
  ) {
    explicit.gpu = specs.gpu;
  }
  if (
    specs.displayResolution &&
    /\b(?:2\s*k|4\s*k|8\s*k|qhd|wqhd|uhd|\d{4}\s*x\s*\d{4}|1440p|2160p|4320p)\b/.test(
      normalized,
    )
  ) {
    explicit.displayResolution = specs.displayResolution;
  }
  if (specs.refreshRateHz && /\b\d{2,3}\s*hz\b/.test(normalized)) {
    explicit.refreshRateHz = specs.refreshRateHz;
  }
  if (specs.wireless && /\b(wireless|khong day)\b/.test(normalized)) {
    explicit.wireless = true;
  }
  return explicit;
}

function mergeActiveRetrievalConstraints(
  constraints: ProductRetrievalConstraints,
  hardConstraints?: ProductRetrievalConstraints,
): ProductRetrievalConstraints {
  if (!hardConstraints) {
    const withoutRequiredSpecs = { ...constraints };
    delete withoutRequiredSpecs.requiredSpecs;
    return withoutRequiredSpecs;
  }

  const hardCategoryHints = uniqueAdviceStrings([
    ...(hardConstraints.categoryHints ?? []),
    hardConstraints.category,
  ]);

  const merged: ProductRetrievalConstraints = {
    ...constraints,
    ...hardConstraints,
    categoryHints:
      hardCategoryHints.length > 0
        ? hardCategoryHints
        : uniqueAdviceStrings(constraints.categoryHints ?? []),
    categoryPath: uniqueAdviceStrings([
      ...(constraints.categoryPath ?? []),
      ...(hardConstraints.categoryPath ?? []),
    ]),
  };
  if (!hardConstraints.requiredSpecs) delete merged.requiredSpecs;
  return merged;
}

function uniqueAdviceStrings(values: Array<string | undefined>): string[] {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value))),
  );
}

function resultSatisfiesVisibleConstraints(
  result: RerankedProductCandidate,
  snapshot: ProductCatalogSnapshot,
  constraints: ProductRetrievalConstraints,
): boolean {
  return productCandidateSatisfiesHardConstraints(
    resultWithSnapshotPayload(result, snapshot),
    constraints,
    { enforceRequiredSpecs: true },
  );
}

function resultWithSnapshotPayload(
  result: RerankedProductCandidate,
  snapshot: ProductCatalogSnapshot,
): RerankedProductCandidate {
  return {
    ...result,
    payload: {
      ...result.payload,
      name: snapshot.name,
      slug: snapshot.slug ?? result.payload.slug,
      category: snapshot.category ?? result.payload.category,
      categoryPath: snapshotCategoryPath(snapshot, result.payload.categoryPath),
      price: Number(snapshot.price ?? result.payload.price),
      discountPrice: Number(
        snapshot.discountPrice ?? result.payload.discountPrice,
      ),
      stock: Number(snapshot.stock ?? result.payload.stock),
      isPublished: snapshot.isPublished ?? result.payload.isPublished,
      isArchived: snapshot.isArchived ?? result.payload.isArchived,
      normalizedSpecs:
        snapshotNormalizedSpecs(snapshot) ?? result.payload.normalizedSpecs,
    },
  };
}

function snapshotNormalizedSpecs(
  snapshot: ProductCatalogSnapshot,
): Record<string, unknown> | undefined {
  const normalizedSpecs = snapshot.searchMetadata?.normalizedSpecs;
  return normalizedSpecs &&
    typeof normalizedSpecs === 'object' &&
    !Array.isArray(normalizedSpecs)
    ? (normalizedSpecs as Record<string, unknown>)
    : undefined;
}
function snapshotCategoryPath(
  snapshot: ProductCatalogSnapshot,
  fallback: string[],
): string[] {
  const categoryPath = snapshot.searchMetadata?.categoryPath;
  if (!Array.isArray(categoryPath)) return fallback;
  return categoryPath
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean);
}
function ensureProductCategorySearchText(
  text: string,
  productCategory?: string,
): string {
  if (!productCategory || mentionsCatalogProduct(text)) return text;
  return `${productCategory} ${text}`.trim();
}

function mentionsCatalogProduct(text: string): boolean {
  return (
    Boolean(detectProductFamilyFromText(text)) ||
    /máy tính|may tinh|sản phẩm|san pham/i.test(
      normalizeProductSearchQuery(text),
    )
  );
}
function isSetupOrComboProductAdvice(text: string): boolean {
  const normalized = normalizeAdviceIntentText(text);
  return /\b(setup|set up|combo|full set|build pc|build may|lap rap|rap may|rig|goc|dan may|dan pc|bo may|bo pc|bo gear|tron bo|ca bo)\b/.test(
    normalized,
  );
}

function expandPerformanceLaptopSearchText(text: string): string {
  const normalized = normalizeAdviceIntentText(text);
  const needsGpuExpansion =
    /\blaptop\b/.test(normalized) &&
    /machine learning|\bai\b|gpu|rtx|render|deep learning|cuda/.test(
      normalized,
    ) &&
    !/\brtx\b|\bgpu\b|nvidia|cuda/.test(normalized);

  return needsGpuExpansion ? `rtx gpu ${text}` : text;
}

function normalizeProductSearchQuery(text: string): string {
  return text
    .replace(/\blaptp\b/gi, 'laptop')
    .replace(/\blap\s+tp\b/gi, 'laptop');
}

function stripProductAdviceControlPhrases(text: string): string {
  return text
    .replace(
      /\b(?:sort|sắp xếp|sap xep)\s+(?:theo\s+)?(?:giá|gia)[^,.;]*/giu,
      ' ',
    )
    .replace(
      /(?:giá|gia)\s+từ\s+(?:trên|tren|cao)\s+xuống\s+(?:dưới|duoi|thấp|thap)/giu,
      ' ',
    )
    .replace(
      /(?:giá|gia)\s+từ\s+(?:dưới|duoi|thấp|thap)\s+lên\s+(?:trên|tren|cao)/giu,
      ' ',
    )
    .replace(
      /\b(?:giá|gia)\s+(?:giảm dần|giam dan|tăng dần|tang dan)\b/giu,
      ' ',
    )
    .replace(/[ ,.;]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

type PriceSortDirection = 'asc' | 'desc';

function isPriorRecommendationSortRequest(text: string): boolean {
  const normalized = normalizeAdviceIntentText(text);
  return (
    /\b(sort|sap xep)\b.*\bgia\b|\bgia\b.*\b(sort|sap xep)\b/.test(
      normalized,
    ) &&
    /\b(san pham|mau|may|laptop|danh sach|cac|nhung)\b.*\b(tren|vua|nay)|\b(o tren|ben tren|vua hien thi|vua goi y|vua de xuat|moi goi y)\b/.test(
      normalized,
    )
  );
}

function sortLedgerByRequestedPrice(
  ledger: AssistantRecommendationLedgerEntry[],
  direction: PriceSortDirection,
): AssistantRecommendationLedgerEntry[] {
  return [...ledger].sort((left, right) => {
    const leftPrice = ledgerEffectivePrice(left);
    const rightPrice = ledgerEffectivePrice(right);
    const priceDelta =
      direction === 'desc' ? rightPrice - leftPrice : leftPrice - rightPrice;
    if (priceDelta !== 0) return priceDelta;
    return left.rank - right.rank;
  });
}

function productCardFromLedger(
  item: AssistantRecommendationLedgerEntry,
): ProductAdviceCard {
  const effectivePrice = item.discountPrice ?? item.price;
  return {
    productId: item.productId,
    name: item.name,
    slug: item.slug,
    detailHref: item.slug
      ? `/products/${item.slug}`
      : `/products/${item.productId}`,
    price: item.price,
    discountPrice: item.discountPrice,
    stock: item.stock,
    reasons: [
      item.specsSummary,
      item.category ? `Danh mục: ${item.category}` : undefined,
      'Nằm trong danh sách vừa hiển thị.',
    ].filter((reason): reason is string => Boolean(reason)),
    availability: {
      status:
        typeof item.stock === 'number' && item.stock <= 0
          ? 'out_of_stock'
          : 'available',
      addable: typeof item.stock !== 'number' || item.stock > 0,
    },
    actionPayload: {
      productId: item.productId,
      actions: ['view_detail', ...(effectivePrice ? ['add_to_cart'] : [])],
    },
    specs: item.specsSummary ? { summary: item.specsSummary } : {},
  };
}

function ledgerEffectivePrice(
  item: AssistantRecommendationLedgerEntry,
): number {
  const discountPrice = Number(item.discountPrice ?? 0);
  if (discountPrice > 0) return discountPrice;
  return Number(item.price ?? 0);
}

function priceSortFromState(
  state: ProductAdviceState,
): PriceSortDirection | undefined {
  const value = state.intentPlan?.priceSort ?? state.parsedEntities?.priceSort;
  return value === 'asc' || value === 'desc' ? value : undefined;
}

function sortResultsByRequestedPrice(
  results: RerankedProductCandidate[],
  snapshotById: Map<string, ProductCatalogSnapshot>,
  direction?: PriceSortDirection,
): RerankedProductCandidate[] {
  if (!direction) return results;

  return [...results].sort((left, right) => {
    const leftPrice = resultEffectivePrice(left, snapshotById);
    const rightPrice = resultEffectivePrice(right, snapshotById);
    const priceDelta =
      direction === 'desc' ? rightPrice - leftPrice : leftPrice - rightPrice;
    if (priceDelta !== 0) return priceDelta;
    return right.rerankScore - left.rerankScore;
  });
}

function resultEffectivePrice(
  result: RerankedProductCandidate,
  snapshotById: Map<string, ProductCatalogSnapshot>,
): number {
  const snapshot = snapshotById.get(result.productId);
  const discountPrice = Number(
    snapshot?.discountPrice ?? result.payload.discountPrice ?? 0,
  );
  if (discountPrice > 0) return discountPrice;
  return Number(snapshot?.price ?? result.payload.price ?? 0);
}
export function parseRequestedRecommendationLimit(
  userText: string,
  maxLimit = readAssistantRecommendationConfig().maxLimit,
): number | null {
  if (
    /[-]\s*\d+\s*(?:mau|mẫu|sản phẩm|san pham|con|lựa chọn|lua chon|products?|options?)\b/i.test(
      userText,
    )
  ) {
    return null;
  }

  const normalized = normalizeAdviceIntentText(userText);
  const match = normalized.match(
    /(?:goi y|de xuat|recommend|cho minh|cho toi|chon|tim)?\s*(\d{1,2})\s*(?:mau|san pham|con|lua chon|products?|options?)\b/,
  );
  if (!match) return null;

  const parsed = Number(match[1]);
  if (!Number.isInteger(parsed) || parsed < 1) return null;
  return Math.min(parsed, maxLimit);
}
async function searchProductCatalog(
  config: ProductAdviceConfig,
  productRetriever: ProductRetriever,
  query: string,
  useFastCatalogSearch: boolean,
  topK: number,
  rewriteContext: {
    query: string;
    originalQuery: string;
    clarificationAnswer?: string;
    hardConstraints?: ProductRetrievalConstraints;
    allowDeterministicShortCircuit?: boolean;
  },
): Promise<ProductRetrievalResult> {
  if (
    useFastCatalogSearch &&
    typeof config.catalogAdapter?.searchProductsFast === 'function'
  ) {
    const fastResult = await config.catalogAdapter.searchProductsFast(query, {
      topK,
    });
    return {
      ...fastResult,
      rewrite: skippedRewriteMetadata(query, 'fast_catalog_exact_lookup'),
    };
  }

  return productRetriever.search(query, {
    topK,
    hardConstraints: rewriteContext.hardConstraints,
    pipeline: 'phase-10-improved',
    rewriteContext: {
      ...rewriteContext,
      query,
      signal: config.abortSignal,
      timeoutMs: config.rewriteTimeoutMs ?? PRODUCT_ADVICE_REWRITE_TIMEOUT_MS,
      allowDeterministicShortCircuit:
        rewriteContext.allowDeterministicShortCircuit === true,
    },
  });
}

function skippedRewriteMetadata(
  query: string,
  reason: string,
): ProductRetrievalRewriteMetadata {
  return {
    rewrittenQuery: query,
    detectedIntents: [],
    productGroups: [],
    hardConstraints: {},
    softSignals: [],
    expandedKeywords: [],
    comboGroups: [],
    metadata: {
      rewrite_provider: 'deepseek',
      rewrite_model: 'not_called',
      rewrite_status: 'skipped',
      rewrite_retry_count: 0,
      rewrite_latency_ms: 0,
      rewritten_query: query,
      rewrite_skipped_reason: reason,
    },
  };
}

function shouldUseFastCatalogSearch(text: string): boolean {
  const normalized = normalizeAdviceIntentText(text);
  if (!mentionsCatalogProduct(normalized)) return false;
  if (!asksForSimpleCatalogLookup(normalized)) return false;
  if (hasAdviceOrPurposeGrammar(normalized)) return false;

  const residual = stripSimpleCatalogLookupTokens(normalized);
  return !residual || hasExactLookupSignal(normalized);
}

function asksForSimpleCatalogLookup(normalized: string): boolean {
  return (
    /\b(co|con|tim|kiem|mua)\b.*\b(nao|khong|ko|k)\b/.test(normalized) ||
    /\b(nao|duoi|toi da|tam gia|ngan sach|gia|con hang|co hang)\b/.test(
      normalized,
    ) ||
    /\d{1,3}\s*(trieu|tr)\b/.test(normalized) ||
    hasExactLookupSignal(normalized)
  );
}

function hasAdviceOrPurposeGrammar(normalized: string): boolean {
  return /\b(tu van|goi y|nen mua|chon|so sanh|phu hop|uu tien|nhu cau|de|dung de|phuc vu|muc dich|lam)\b/.test(
    normalized,
  );
}

function stripSimpleCatalogLookupTokens(normalized: string): string {
  return normalized
    .replace(
      /\b(laptop|pc|may tinh|man hinh|ban phim|chuot|tai nghe|ssd|ram|cpu|vga|linh kien|san pham|mau|may|bo)\b/g,
      ' ',
    )
    .replace(
      /\b(co|con|tim|kiem|mua|nao|khong|ko|k|duoi|toi da|tam gia|ngan sach|gia|con hang|co hang|trieu|tr|ban|minh|toi|em|shop|nhe|nha|giup|voi|cho)\b/g,
      ' ',
    )
    .replace(/\b\d{1,3}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasExactLookupSignal(normalized: string): boolean {
  return (
    /\b[A-Za-z]*\d[A-Za-z0-9-]{3,}\b/.test(normalized) ||
    /\b(?:sku|ma|model)\b/.test(normalized)
  );
}

function normalizeAdviceIntentText(text: string): string {
  return normalizeProductSearchQuery(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isInformationalDefinitionRequest(normalizedText: string): boolean {
  return /\b(la gi|nghia la gi|khai niem|dinh nghia|what is|what are)\b/.test(
    normalizedText,
  );
}

function isBroadProductAdviceRequest(text: string): boolean {
  const normalized = normalizeAdviceIntentText(text);
  const asksForAdvice = /\b(tu van|goi y|can mua|can|nen mua|chon)\b/.test(
    normalized,
  );
  const mentionsGenericProduct = /\b(laptop|pc|may tinh|san pham)\b/.test(
    normalized,
  );
  if (!asksForAdvice || !mentionsGenericProduct) return false;

  return !specificProductAdviceResidual(normalized);
}

function specificProductAdviceResidual(normalized: string): string {
  return normalized
    .replace(
      /\b(tu van|goi y|can mua|can|nen mua|chon|ve|cho|minh|toi|em|shop|nhe|nha|giup|voi|tao|tui|to|ban|co|a|anh|chi|de)\b/g,
      ' ',
    )
    .replace(/\b(laptop|pc|may tinh|san pham|mau|may|bo)\b/g, ' ')
    .replace(/\b(pho thong|co ban|basic|entry level)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function snapshotFromResult(
  result: RerankedProductCandidate,
): ProductCatalogSnapshot {
  return {
    productId: result.payload.productId,
    name: result.payload.name,
    slug: result.payload.slug,
    price: result.payload.price,
    discountPrice: result.payload.discountPrice,
    stock: result.payload.stock,
    category: result.payload.category,
    searchMetadata: {
      categoryPath: result.payload.categoryPath,
      normalizedSpecs: result.payload.normalizedSpecs,
    },
    isPublished: result.payload.isPublished,
    isArchived: result.payload.isArchived,
  };
}

function uniqueResultsByProductId(
  results: RerankedProductCandidate[],
): RerankedProductCandidate[] {
  const byId = new Map<string, RerankedProductCandidate>();
  for (const result of results) {
    if (!byId.has(result.productId)) {
      byId.set(result.productId, result);
    }
  }
  return [...byId.values()];
}

function uniqueProductCardsByProductId(
  productCards: ProductAdviceCard[],
): ProductAdviceCard[] {
  const byId = new Map<string, ProductAdviceCard>();
  for (const card of productCards) {
    if (card.productId && !byId.has(card.productId)) {
      byId.set(card.productId, card);
    }
  }
  return [...byId.values()];
}

function uniqueProductGroupsByProductId(
  groups: ProductAdviceProductGroup[],
): ProductAdviceProductGroup[] {
  const seen = new Set<string>();
  return groups
    .map((group) => ({
      ...group,
      productCards: group.productCards.filter((card) => {
        if (!card.productId || seen.has(card.productId)) return false;
        seen.add(card.productId);
        return true;
      }),
    }))
    .filter((group) => group.productCards.length > 0);
}

function minimalNoResultText(retrieval: { explanation?: string }): string {
  return (
    retrieval.explanation ??
    'Catalog hiện chưa có sản phẩm đủ dữ liệu cho yêu cầu này. Bạn có thể nới ngân sách hoặc bổ sung tiêu chí để mình tìm lại.'
  );
}

function rewriteTraceMetadata(retrieval: ProductRetrievalResult) {
  return retrieval.rewrite?.metadata ?? {};
}

function buildProductToolCalls(
  retrieval: {
    effectiveQuery?: string;
    cragRetry?: unknown;
    crag_retry?: unknown;
  },
  productIds: string[],
) {
  return [
    {
      toolName: 'search_products',
      subgraph: 'sales',
      status: 'success',
      inputSummary: retrieval.effectiveQuery,
      outputSummary: `${productIds.length} product ids`,
    },
    {
      toolName: 'get_product_snapshot',
      subgraph: 'sales',
      status: 'success',
      inputSummary: productIds.join(', '),
      outputSummary: `${productIds.length} product snapshots`,
    },
  ];
}

function toProductCard(
  result: RerankedProductCandidate,
  snapshot: {
    productId: string;
    name: string;
    slug?: string;
    image?: string;
    images?: string[];
    price?: number;
    discountPrice?: number;
    stock?: number;
    searchMetadata?: Record<string, unknown>;
    attributes?: Record<string, unknown>;
    isPublished?: boolean;
    isArchived?: boolean;
  },
): ProductAdviceCard {
  const stock = Number(snapshot.stock ?? 0);
  const addable =
    stock > 0 && snapshot.isPublished !== false && snapshot.isArchived !== true;
  const status = addable
    ? 'available'
    : stock <= 0
      ? 'out_of_stock'
      : 'unavailable';
  const actions = ['VIEW_PRODUCT'];
  if (addable) actions.push('ADD_TO_CART');

  const reasons: string[] = [];

  return {
    productId: snapshot.productId,
    name: snapshot.name,
    price: snapshot.price,
    discountPrice: snapshot.discountPrice,
    stock,
    slug: snapshot.slug,
    detailHref: snapshot.slug
      ? `/products/${snapshot.slug}`
      : `/products/${snapshot.productId}`,
    image: snapshot.image ?? snapshot.images?.[0],
    reasons,
    availability: {
      status,
      addable,
    },
    actionPayload: {
      productId: snapshot.productId,
      actions,
    },
    specs: specsFromSnapshot(snapshot),
  };
}

function specsFromSnapshot(snapshot: {
  searchMetadata?: Record<string, unknown>;
  attributes?: Record<string, unknown>;
}): Record<string, unknown> {
  const normalizedSpecs = snapshot.searchMetadata?.normalizedSpecs;
  if (normalizedSpecs && typeof normalizedSpecs === 'object') {
    return normalizedSpecs as Record<string, unknown>;
  }
  const specsSummary = snapshot.searchMetadata?.specsSummary;
  if (typeof specsSummary === 'string' && specsSummary.trim()) {
    return { specsSummary: specsSummary.trim() };
  }
  return snapshot.attributes ?? {};
}
