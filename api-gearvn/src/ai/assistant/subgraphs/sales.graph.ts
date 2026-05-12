import { END, START, StateGraph } from '@langchain/langgraph';

import {
  AssistantIntent,
  AssistantResolvedProductContext,
  AssistantToolCallTrace,
} from '../assistant.types';
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
import { productAdviceNode } from '../nodes/product-advice.node';
import { reviewSummaryNode } from '../nodes/review-summary.node';
import { productDetailNode } from '../nodes/product-detail.node';
import { ProductContextResolver } from '../resolvers/product-context.resolver';

type SalesConfig = {
  configurable?: {
    promptContext?: Record<string, unknown>;
    abortSignal?: AbortSignal;
    handlers?: {
      productAdvice?: (state: ShoppingAssistantStateType) => Promise<any>;
      reviewSummary?: (state: ShoppingAssistantStateType) => Promise<any>;
      productDetail?: (state: ShoppingAssistantStateType) => Promise<any>;
      productContextResolver?: (
        state: ShoppingAssistantStateType,
      ) => Promise<AssistantResolvedProductContext>;
    };
    productRetriever?: any;
    catalogAdapter?: any;
    responseComposer?: any;
    sessionService?: any;
    roomId?: string;
    reviewSearchClient?: any;
  };
};

async function salesProductAdviceNode(
  state: ShoppingAssistantStateType,
  config?: SalesConfig,
): Promise<ShoppingAssistantStateUpdate> {
  const result =
    (await config?.configurable?.handlers?.productAdvice?.(state)) ??
    (await productAdviceNode(state, {
      productRetriever: config?.configurable?.productRetriever,
      catalogAdapter: config?.configurable?.catalogAdapter,
      responseComposer: config?.configurable?.responseComposer,
      sessionService: config?.configurable?.sessionService,
      roomId: config?.configurable?.roomId,
      promptContext: config?.configurable?.promptContext,
      abortSignal: config?.configurable?.abortSignal,
    }));
  return responseUpdate('product_advice', result, state);
}

async function salesProductDetailNode(
  state: ShoppingAssistantStateType,
  config?: SalesConfig,
): Promise<ShoppingAssistantStateUpdate> {
  const result =
    (await config?.configurable?.handlers?.productDetail?.(state)) ??
    (await productDetailNode(state, {
      catalogAdapter: config?.configurable?.catalogAdapter,
      reviewSearchClient: config?.configurable?.reviewSearchClient,
      sessionService: config?.configurable?.sessionService,
      roomId: config?.configurable?.roomId,
      abortSignal: config?.configurable?.abortSignal,
    }));
  return responseUpdate('product_detail', result, state);
}

async function salesReviewSummaryNode(
  state: ShoppingAssistantStateType,
  config?: SalesConfig,
): Promise<ShoppingAssistantStateUpdate> {
  const startedAt = Date.now();
  const result =
    (await config?.configurable?.handlers?.reviewSummary?.(state)) ??
    (await reviewSummaryNode(
      { ...state, productContext: productContextFromMetadata(state) },
      {
        reviewSearchClient: config?.configurable?.reviewSearchClient,
        abortSignal: config?.configurable?.abortSignal,
      },
    ));
  const update = responseUpdate('review_summary', result, state);
  const traceEvents = Array.isArray(update.traceEvents)
    ? update.traceEvents
    : [];
  return {
    ...update,
    traceEvents: traceEvents.map((event) =>
      event.node === 'review_summary'
        ? { ...event, web_review_latency_ms: Date.now() - startedAt }
        : event,
    ),
  };
}

async function productContextResolverNode(
  state: ShoppingAssistantStateType,
  config?: SalesConfig,
): Promise<ShoppingAssistantStateUpdate> {
  const startedAt = Date.now();
  const shouldResolveContext = shouldResolveProductContext(state);
  const handler = config?.configurable?.handlers?.productContextResolver;
  const resolver =
    handler || !shouldResolveContext
      ? null
      : config?.configurable?.sessionService
        ? new ProductContextResolver(
            config.configurable.sessionService,
            config.configurable.catalogAdapter,
          )
        : null;
  const productContext =
    (shouldResolveContext ? await handler?.(state) : undefined) ??
    (await resolver?.resolve({
      roomId: config?.configurable?.roomId ?? state.roomId,
      userText: state.userText,
      intent: state.primaryIntent,
      entities: state.parsedEntities,
    })) ??
    ({
      status: 'unresolved',
      matchSource: 'unresolved',
      confidence: 0,
    } satisfies AssistantResolvedProductContext);

  const shouldTraceResolver =
    productContext.status === 'resolved' ||
    productContext.status === 'clarification_required' ||
    hasExplicitPublicSourceRequest(state.userText);

  return {
    metadata: {
      ...(state.metadata ?? {}),
      productContext,
    },
    routeTrace: shouldTraceResolver ? ['product_context_resolver'] : [],
    traceEvents: [
      {
        roomId: state.roomId,
        node: 'product_context_resolver',
        active_subgraph: 'sales',
        product_context_status: productContext.status,
        product_context_match_source: productContext.matchSource,
        product_context_latency_ms: Date.now() - startedAt,
      },
    ],
  };
}

function shouldResolveProductContext(
  state: ShoppingAssistantStateType,
): boolean {
  const entities = (state.parsedEntities ?? {}) as Record<string, unknown>;
  return (
    Boolean(entities.requiresProductSelection) ||
    Boolean(entities.pendingCartAction) ||
    Boolean(entities.cartAction) ||
    state.intents?.includes(AssistantIntent.REVIEW_SUMMARY) === true ||
    hasCatalogDetailRequest(state.userText) ||
    hasExplicitPublicSourceRequest(state.userText)
  );
}

function publicReviewGateNode(
  state: ShoppingAssistantStateType,
): ShoppingAssistantStateUpdate {
  return {
    routeTrace: ['public_review'],
    traceEvents: [
      {
        roomId: state.roomId,
        node: 'public_review',
        active_subgraph: 'sales',
        explicit_public_review: true,
      },
    ],
  };
}

function productContextClarificationNode(
  state: ShoppingAssistantStateType,
): ShoppingAssistantStateUpdate {
  const productContext = productContextFromMetadata(state);
  const result = {
    intent: AssistantIntent.REVIEW_SUMMARY,
    nodeName: 'product_context_clarification',
    text:
      productContext?.clarification?.text ??
      'Mình chưa chắc bạn đang hỏi sản phẩm nào. Bạn nói rõ tên hoặc số thứ tự giúp mình nhé.',
    metadata: {
      productContext,
      active_subgraph: 'sales',
      fallback_reason: 'product_context_clarification_required',
    },
  };
  return responseUpdate('product_context_clarification', result, state);
}

function routeSales(
  state: ShoppingAssistantStateType,
):
  | 'product_advice'
  | 'product_detail'
  | 'public_review'
  | 'review_summary'
  | 'product_context_clarification' {
  const productContext = productContextFromMetadata(state);
  if (productContext?.status === 'clarification_required') {
    return 'product_context_clarification';
  }
  if (
    state.intents?.includes(AssistantIntent.REVIEW_SUMMARY) &&
    productContext?.status === 'resolved' &&
    hasCatalogDetailRequest(state.userText)
  ) {
    return 'product_detail';
  }
  if (hasExplicitPublicSourceRequest(state.userText)) return 'public_review';
  if (state.intents?.includes(AssistantIntent.REVIEW_SUMMARY)) {
    return 'review_summary';
  }
  return 'product_advice';
}

function productContextFromMetadata(
  state: ShoppingAssistantStateType,
): AssistantResolvedProductContext | undefined {
  const value = state.metadata?.productContext;
  return value && typeof value === 'object'
    ? (value as AssistantResolvedProductContext)
    : undefined;
}

const PUBLIC_REVIEW_REQUEST_PATTERNS = [
  'nguồn công khai',
  'trên mạng',
  'review cộng đồng',
  'web',
  'citation',
  'trích dẫn',
  'public source',
  'public review',
  'community review',
];

function routeAfterProductDetail(
  state: ShoppingAssistantStateType,
): 'public_review' | 'sales_merge' {
  return hasExplicitPublicSourceRequest(state.userText)
    ? 'public_review'
    : 'sales_merge';
}

function hasCatalogDetailRequest(userText: string): boolean {
  const normalized = normalizeText(userText);
  return /\b(?:review|danh gia|thong tin|mo ta|xem)\b.*\b(?:chi tiet|detail)\b|\b(?:chi tiet|detail)\b|\b(?:thong so|cau hinh|spec|specs|cpu|gpu|ram|ssd|pin|cong ket noi|man hinh)\b/.test(
    normalized,
  );
}

function hasExplicitPublicSourceRequest(userText: string): boolean {
  const normalized = normalizeText(userText);
  return PUBLIC_REVIEW_REQUEST_PATTERNS.some((pattern) =>
    normalized.includes(normalizeText(pattern)),
  );
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}
function responseUpdate(
  nodeName: string,
  result: any,
  state: ShoppingAssistantStateType,
): ShoppingAssistantStateUpdate {
  const response = normalizeResponse(nodeName, result);
  return {
    responses: [response],
    actionDrafts: extractActionDrafts(result),
    routeTrace: [nodeName],
    traceEvents: [
      {
        roomId: state.roomId,
        node: nodeName,
        intent: response.intent as AssistantIntent,
        active_subgraph: 'sales',
        tool_calls: traceToolCalls(response.metadata?.tool_calls),
        retrieval_query: traceString(response.metadata?.retrieval_query),
        crag_retry: traceCragRetry(response.metadata?.crag_retry),
        productIds: response.metadata?.productIds,
        catalog_detail_latency_ms: response.metadata?.catalog_detail_latency_ms,
        fallback_reason: traceString(response.metadata?.fallback_reason),
      },
    ],
  };
}

function traceToolCalls(value: unknown): AssistantToolCallTrace[] | undefined {
  return Array.isArray(value) ? (value as AssistantToolCallTrace[]) : undefined;
}

function traceString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function traceCragRetry(
  value: unknown,
): boolean | number | Record<string, unknown> | undefined {
  if (
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    (value && typeof value === 'object' && !Array.isArray(value))
  ) {
    return value as boolean | number | Record<string, unknown>;
  }
  return undefined;
}

function normalizeResponse(nodeName: string, result: any): AssistantResponse {
  const response = result as AssistantNodeResponse;
  const intent =
    response?.intent ??
    (nodeName === 'review_summary'
      ? AssistantIntent.REVIEW_SUMMARY
      : AssistantIntent.PRODUCT_ADVICE);
  return {
    intent,
    nodeName: response?.nodeName ?? nodeName,
    text: response?.text ?? '',
    metadata: response?.metadata ?? result?.metadata ?? {},
  };
}

function extractActionDrafts(result: any) {
  return result?.draft ? [result.draft] : [];
}

function salesMergeNode(
  state: ShoppingAssistantStateType,
): ShoppingAssistantStateUpdate {
  const merged = mergeAssistantResponses(state.responses ?? []);
  return {
    text: merged.text,
    metadata: { ...(state.metadata ?? {}), ...merged.metadata },
  };
}

export const salesSubgraph = new StateGraph(ShoppingAssistantState)
  .addNode('product_context_resolver', productContextResolverNode)
  .addNode('product_advice', salesProductAdviceNode)
  .addNode('product_detail', salesProductDetailNode)
  .addNode('public_review', publicReviewGateNode)
  .addNode('review_summary', salesReviewSummaryNode)
  .addNode('product_context_clarification', productContextClarificationNode)
  .addNode('sales_merge', salesMergeNode)
  .addEdge(START, 'product_context_resolver')
  .addConditionalEdges('product_context_resolver', routeSales)
  .addEdge('product_advice', 'sales_merge')
  .addConditionalEdges('product_detail', routeAfterProductDetail)
  .addEdge('public_review', 'review_summary')
  .addEdge('review_summary', 'sales_merge')
  .addEdge('product_context_clarification', 'sales_merge')
  .addEdge('sales_merge', END)
  .compile();
