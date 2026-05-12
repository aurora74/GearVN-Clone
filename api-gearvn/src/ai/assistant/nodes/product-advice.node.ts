import {
  ProductCatalogAdapter,
  ProductCatalogSnapshot,
} from '../adapters/product-catalog.adapter';
import { ProductRetriever } from '../../retrieval/product-retriever';
import { productCandidateSatisfiesHardConstraints } from '../../retrieval/product-reranker';
import {
  ProductRetrievalConstraints,
  ProductRetrievalResult,
  ProductRerankReason,
  RerankedProductCandidate,
} from '../../retrieval/product-retrieval.types';
import type {
  AssistantProductCard,
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
};

type ProductAdviceCard = AssistantProductCard;

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
    active_subgraph?: 'sales';
    tool_calls?: ReturnType<typeof buildProductToolCalls>;
    tool_results?: ProductAdviceToolResults;
    requested_recommendation_limit?: number | null;
    applied_recommendation_limit?: number;
    product_card_count?: number;
    price_sort?: PriceSortDirection;
    llmComposed: boolean;
  };
};

const PRODUCT_ADVICE_COMPOSE_TIMEOUT_MS = 18_000;

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

export async function productAdviceNode(
  state: ProductAdviceState,
  config: ProductAdviceConfig,
): Promise<ProductAdviceResult> {
  const requestedMoreOptions =
    state.intentPlan?.requestedMoreOptions === true ||
    state.requestedMoreOptions === true;
  const broadNeed =
    state.intentPlan?.broadNeed === true ||
    isBroadProductAdviceRequest(state.userText);
  const followUpQuestions = broadNeed ? PRODUCT_ADVICE_FOLLOW_UP_QUESTIONS : [];

  if (broadNeed && !requestedMoreOptions) {
    return {
      intent: 'PRODUCT_ADVICE',
      nodeName: 'product_advice',
      text: buildClarificationText(followUpQuestions),
      metadata: {
        productCards: [],
        followUpQuestions,
        needsClarification: true,
        llmComposed: false,
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
      const productCards = sortLedgerByRequestedPrice(ledger, priceSort)
        .slice(0, ledgerLimit)
        .map(productCardFromLedger);
      const productIds = productCards.map((card) => card.productId);

      if (productCards.length > 0) {
        await config.sessionService?.saveRecommendationLedger(
          roomId,
          productCards,
        );
        throwIfAborted(config.abortSignal);
      }

      return {
        intent: 'PRODUCT_ADVICE',
        nodeName: 'product_advice',
        text: buildPriorRecommendationSortText(productCards, priceSort),
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
          llmComposed: false,
        },
      };
    }
  }

  const productRetriever =
    config.productRetriever ?? config.catalogAdapter?.productRetriever;
  if (!productRetriever) {
    throw new Error('productAdviceNode requires ProductRetriever');
  }

  const retrievalLimit = priceSort
    ? Math.max(cardLimit, recommendationConfig.maxLimit)
    : cardLimit;
  const customerFacingText = stripProductAdviceControlPhrases(
    normalizeProductSearchQuery(productCustomerText(state)),
  );
  const searchQuery = stripProductAdviceControlPhrases(
    normalizeProductSearchQuery(productSearchText(state)),
  );
  const responseUserText = customerFacingText || searchQuery;
  const useFastCatalogSearch =
    !requestedMoreOptions &&
    shouldUseFastCatalogSearch(searchQuery) &&
    typeof config.catalogAdapter?.searchProductsFast === 'function';
  const retrieval = await searchProductCatalog(
    config,
    productRetriever,
    searchQuery,
    useFastCatalogSearch,
    retrievalLimit,
  );
  throwIfAborted(config.abortSignal);
  const candidateResults = retrieval.results;
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
      ? resultSatisfiesVisibleConstraints(
          result,
          snapshot,
          retrieval.query.constraints,
        )
      : false;
  });
  const constrainedResults = sortResultsByRequestedPrice(
    filteredResults,
    snapshotById,
    priceSort,
  ).slice(0, cardLimit);
  const productIds = constrainedResults.map((result) => result.productId);

  const productCards: ProductAdviceCard[] = constrainedResults.map((result) => {
    const snapshot = snapshotById.get(result.productId)!;
    return toProductCard(result, snapshot);
  });

  throwIfAborted(config.abortSignal);
  if (roomId && productCards.length > 0) {
    await config.sessionService?.saveRecommendationLedger(roomId, productCards);
  }
  throwIfAborted(config.abortSignal);

  if (productCards.length === 0) {
    const text = emptyGroundedProductText(retrieval);
    return {
      intent: 'PRODUCT_ADVICE',
      nodeName: 'product_advice',
      text,
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
        requested_recommendation_limit: requestedRecommendationLimit,
        applied_recommendation_limit: cardLimit,
        price_sort: priceSort,
        product_card_count: productCards.length,
        llmComposed: false,
      },
    };
  }

  const groundedInfoText = buildGroundedProductInfoText(
    responseUserText,
    productCards,
  );
  const composedText = groundedInfoText
    ? null
    : await composeProductAdviceText(config, {
        userText: responseUserText,
        productCards,
        followUpQuestions,
      });
  const usableComposedText = isUsableComposedAdviceText(
    composedText,
    productCards.length,
  )
    ? composedText
    : null;
  const fallbackText =
    groundedInfoText ??
    buildProductAdviceFallbackText(responseUserText, productCards);

  return {
    intent: 'PRODUCT_ADVICE',
    nodeName: 'product_advice',
    text: usableComposedText ?? fallbackText,
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
      requested_recommendation_limit: requestedRecommendationLimit,
      applied_recommendation_limit: cardLimit,
      price_sort: priceSort,
      product_card_count: productCards.length,
      llmComposed: Boolean(usableComposedText),
    },
  };
}

function buildClarificationText(followUpQuestions: string[]): string {
  return [
    'Mình có thể tư vấn laptop sát nhu cầu hơn nếu bạn cho mình thêm vài thông tin.',
    ...followUpQuestions,
  ].join(' ');
}
async function composeProductAdviceText(
  config: ProductAdviceConfig,
  input: {
    userText: string;
    productCards: ProductAdviceCard[];
    followUpQuestions: string[];
  },
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const composeSignal = combineAbortSignals(
      config.abortSignal,
      controller.signal,
    );
    const composePromise = config.responseComposer?.composeProductAdvice({
      ...input,
      promptContext: config.promptContext,
      signal: composeSignal,
    });
    return composePromise
      ? await withTimeout(
          composePromise,
          PRODUCT_ADVICE_COMPOSE_TIMEOUT_MS,
          () => controller.abort(),
        )
      : null;
  } catch {
    return null;
  }
}

function isUsableComposedAdviceText(
  text: string | null,
  productCardCount: number,
): text is string {
  return (
    isCompleteAdviceText(text) &&
    !hasConflictingProductCountClaim(text, productCardCount)
  );
}

function isCompleteAdviceText(text: string | null): text is string {
  if (!text) return false;
  return /[.!?…]$/.test(text.trim());
}

function hasConflictingProductCountClaim(
  text: string,
  productCardCount: number,
): boolean {
  const claimedCounts = extractProductCountClaims(text);
  return claimedCounts.some((count) => count !== productCardCount);
}

function extractProductCountClaims(text: string): number[] {
  const normalized = normalizeAdviceIntentText(text);
  if (!normalized) return [];

  const counts = new Set<number>();
  const numericPattern = new RegExp(
    `\\b(\\d{1,2})\\s+(?:${PRODUCT_COUNT_NOUN_PATTERN})\\b`,
    'g',
  );
  let numericMatch: RegExpExecArray | null;
  while ((numericMatch = numericPattern.exec(normalized)) !== null) {
    const count = Number(numericMatch[1]);
    if (Number.isInteger(count)) counts.add(count);
  }

  const wordPattern = new RegExp(
    `\\b(${PRODUCT_COUNT_WORD_PATTERN})\\s+(?:${PRODUCT_COUNT_NOUN_PATTERN})\\b`,
    'g',
  );
  let wordMatch: RegExpExecArray | null;
  while ((wordMatch = wordPattern.exec(normalized)) !== null) {
    const count = PRODUCT_COUNT_WORDS[wordMatch[1]];
    if (Number.isInteger(count)) counts.add(count);
  }

  return [...counts];
}
function buildGroundedProductInfoText(
  userText: string,
  productCards: ProductAdviceCard[],
): string | null {
  if (isWarrantyQuestion(userText) && !hasExplicitWarrantyFact(productCards)) {
    return defaultWarrantyInfoText(productCards);
  }

  return null;
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

function buildProductAdviceFallbackText(
  userText: string,
  productCards: ProductAdviceCard[],
): string {
  if (isWarrantyQuestion(userText)) {
    return defaultWarrantyInfoText(productCards);
  }

  return defaultProductAdviceText(productCards, userText);
}

function isWarrantyQuestion(text: string): boolean {
  return /bao hanh|warranty/.test(normalizeAdviceIntentText(text));
}

function defaultWarrantyInfoText(productCards: ProductAdviceCard[]): string {
  const productLines = productCards.slice(0, 3).map((card, index) => {
    const price = card.discountPrice ?? card.price;
    const priceText = Number.isFinite(price)
      ? ` - ${formatCurrency(Number(price))}`
      : '';
    return `${index + 1}. ${card.name}${priceText}.`;
  });

  return [
    'Mình chưa thấy dữ liệu thời hạn bảo hành trong catalog cho các mẫu đang lọc, nên chưa thể khẳng định số năm bảo hành.',
    ...productLines,
    'Bạn có thể mở trang chi tiết sản phẩm hoặc để nhân viên tư vấn xác nhận chính sách bảo hành chính xác cho mẫu bạn chọn.',
  ].join(' ');
}

function defaultProductAdviceText(
  productCards: ProductAdviceCard[],
  userText = '',
): string {
  if (productCards.length === 0) {
    return 'Mình chưa tìm thấy sản phẩm phù hợp. Bạn có thể nới ngân sách hoặc nói rõ nhu cầu chính không?';
  }

  const productLines = productCards.map((card, index) => {
    const price = card.discountPrice ?? card.price;
    const priceText = Number.isFinite(price)
      ? ` - ${formatCurrency(Number(price))}`
      : '';
    const stockText = Number(card.stock ?? 0) > 0 ? ' còn hàng' : ' hết hàng';
    return `${index + 1}. ${card.name}${priceText}${stockText}.`;
  });

  const contextIntro = productAdviceContextIntro(userText);
  return [
    contextIntro ?? 'Mình tìm thấy một số sản phẩm phù hợp từ catalog GearVN:',
    ...productLines,
    'Bạn muốn mình lọc tiếp theo nhu cầu sử dụng, thương hiệu, màn hình hay pin không?',
  ].join(' ');
}

function buildPriorRecommendationSortText(
  productCards: ProductAdviceCard[],
  direction: PriceSortDirection,
): string {
  const orderText = direction === 'desc' ? 'cao xuống thấp' : 'thấp lên cao';
  const productLines = productCards.map((card, index) => {
    const price = card.discountPrice ?? card.price;
    const priceText = Number.isFinite(price)
      ? ` - ${formatCurrency(Number(price))}`
      : '';
    const stockText = Number(card.stock ?? 0) > 0 ? ' còn hàng' : ' hết hàng';
    return `${index + 1}. ${card.name}${priceText}${stockText}.`;
  });

  return [
    `Mình sắp xếp lại các sản phẩm vừa hiển thị theo giá từ ${orderText}:`,
    ...productLines,
    'Bạn muốn xem chi tiết mẫu nào?',
  ].join(' ');
}

function productAdviceContextIntro(userText: string): string | null {
  const normalized = normalizeAdviceIntentText(userText);
  const contextParts: string[] = [];

  const category = extractAdviceCategory(normalized);
  if (category) contextParts.push(`nhóm ${category}`);

  const budgetMatch = normalized.match(
    /(?:ngan sach|tam gia|khoang|duoi|toi da)?\s*(\d{1,3})\s*(?:trieu|tr)\b/,
  );
  if (budgetMatch) {
    contextParts.push(`ngân sách khoảng ${budgetMatch[1]} triệu`);
  }

  const useCase = extractAdviceUseCase(userText);
  if (useCase) contextParts.push(`nhu cầu ${useCase}`);

  if (contextParts.length === 0) return null;
  return `Mình dựa trên ${contextParts.join(', ')} bạn vừa nêu; dưới đây là các lựa chọn trong catalog GearVN:`;
}

function extractAdviceCategory(normalizedText: string): string | null {
  const categories: Array<[RegExp, string]> = [
    [/\blaptop\b/, 'laptop'],
    [/\bpc\b/, 'PC'],
    [/\bmay tinh\b/, 'máy tính'],
    [/\bman hinh\b/, 'màn hình'],
    [/\bban phim\b/, 'bàn phím'],
    [/\bchuot\b/, 'chuột'],
    [/\btai nghe\b/, 'tai nghe'],
    [/\bssd\b/, 'SSD'],
    [/\bram\b/, 'RAM'],
    [/\bcpu\b/, 'CPU'],
    [/\bgpu\b|\bvga\b/, 'GPU'],
  ];

  return categories.find(([pattern]) => pattern.test(normalizedText))?.[1] ?? null;
}


function extractAdviceUseCase(text: string): string | null {
  const explicitMatch = text.match(
    /(?:để|de|dùng để|dung de|phục vụ|phuc vu)\s+([^.,;!?]{3,80})/iu,
  );
  const explicitValue = explicitMatch?.[1]
    ?.replace(/\s+(?:thì|thi|nhé|nhe|nha)$/iu, '')
    .trim();
  if (explicitValue) return explicitValue;

  const commaAfterBudgetMatch = text.match(
    /\b\d{1,3}\s*(?:triệu|trieu|tr)\b(?:\s*(?:đổ xuống|do xuong|trở xuống|tro xuong|dưới|duoi|tối đa|toi da))?\s*[,;]\s*([^.,;!?]{3,80})/iu,
  );
  const commaValue = commaAfterBudgetMatch?.[1]
    ?.replace(/\s+(?:thì|thi|nhé|nhe|nha)$/iu, '')
    .trim();
  return commaValue || null;
}

function formatCurrency(value: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(value)}₫`;
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

function productCustomerText(state: ProductAdviceState): string {
  const productCategory = asString(state.parsedEntities?.productCategory);
  const contextualUserText = asString(state.intentPlan?.contextualUserText);
  if (contextualUserText) {
    return ensureProductCategorySearchText(contextualUserText, productCategory);
  }

  const entityContextualUserText = asString(
    state.parsedEntities?.contextualUserText,
  );
  if (entityContextualUserText) {
    return ensureProductCategorySearchText(
      entityContextualUserText,
      productCategory,
    );
  }

  if (productCategory && !mentionsCatalogProduct(state.userText)) {
    return `${productCategory} ${state.userText}`.trim();
  }

  return state.userText;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function resultSatisfiesVisibleConstraints(
  result: RerankedProductCandidate,
  snapshot: ProductCatalogSnapshot,
  constraints: ProductRetrievalConstraints,
): boolean {
  return productCandidateSatisfiesHardConstraints(
    resultWithSnapshotPayload(result, snapshot),
    constraints,
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
    },
  };
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
  return /\blaptop\b|\bpc\b|máy tính|may tinh|sản phẩm|san pham|màn hình|man hinh|bàn phím|ban phim|chuột|chuot|tai nghe|ssd|ram|cpu|vga/i.test(
    normalizeProductSearchQuery(text),
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
): Promise<ProductRetrievalResult> {
  if (
    useFastCatalogSearch &&
    typeof config.catalogAdapter?.searchProductsFast === 'function'
  ) {
    return config.catalogAdapter.searchProductsFast(query, { topK });
  }

  if (typeof config.catalogAdapter?.searchProducts === 'function') {
    return config.catalogAdapter.searchProducts(query, { topK });
  }

  return productRetriever.search(query, { topK });
}

function shouldUseFastCatalogSearch(text: string): boolean {
  const normalized = normalizeAdviceIntentText(text);
  const mentionsCatalogProduct =
    /\blaptop\b|\bpc\b|may tinh|man hinh|ban phim|chuot|tai nghe|ssd|ram/.test(
      normalized,
    );
  const asksForAvailabilityOrBudget =
    /\b(co|con|tim|kiem|mua)\b.*\b(nao|khong|ko)\b/.test(normalized) ||
    /\b(nao|duoi|toi da|tam gia|ngan sach|gia)\b/.test(normalized) ||
    /\d{1,3}\s*(trieu|tr)\b/.test(normalized);
  const asksForDeepAdvice = /\b(tu van|goi y|nen mua|chon|so sanh)\b/.test(
    normalized,
  );

  return (
    mentionsCatalogProduct && asksForAvailabilityOrBudget && !asksForDeepAdvice
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

function isBroadProductAdviceRequest(text: string): boolean {
  const normalized = normalizeAdviceIntentText(text);
  const asksForAdvice = /tu van|goi y|\bcan\b|can mua|nen mua|chon/.test(
    normalized,
  );
  const mentionsGenericProduct = /laptop|\bpc\b|may tinh|san pham/.test(
    normalized,
  );
  if (!asksForAdvice || !mentionsGenericProduct) return false;

  const hasBudget = /\d|trieu|ngan sach|tam gia|tam |duoi|khoang/.test(
    normalized,
  );
  const hasUseCase =
    /gaming|game|hoc|van phong|do hoa|render|lap trinh|code|ai|creator|thiet ke/.test(
      normalized,
    );
  const hasSpec =
    /rtx|gtx|ram|ssd|cpu|gpu|i[3579]|ryzen|oled|inch|man hinh|mong nhe|pin|tan nhiet/.test(
      normalized,
    );

  return !hasBudget && !hasUseCase && !hasSpec;
}

function emptyGroundedProductText(retrieval: {
  explanation?: string;
  cragRetry?: { relaxedConstraints?: string[] };
  crag_retry?: { relaxedConstraints?: string[] };
}): string {
  const relaxed =
    retrieval.cragRetry?.relaxedConstraints ??
    retrieval.crag_retry?.relaxedConstraints ??
    [];
  if (relaxed.includes('rtx_4090')) {
    return 'Mình chưa tìm thấy laptop RTX 4090 phù hợp với ngân sách này trong catalog. Bạn có muốn mình nới yêu cầu GPU sang RTX 4060/4070 hoặc tăng ngân sách để tìm lựa chọn sát hơn không?';
  }
  return (
    retrieval.explanation ??
    'Mình chưa tìm thấy sản phẩm đủ dữ liệu trong catalog. Bạn có thể nới ngân sách hoặc nói rõ nhu cầu chính để mình tìm lại không?'
  );
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

  const reasons = result.reasons
    .map((reason) => presentableReason(reason))
    .filter((message): message is string => Boolean(message));

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
    reasons: reasons.length > 0 ? reasons : ['Phù hợp với nhu cầu đã nêu.'],
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

function presentableReason(reason: ProductRerankReason): string | null {
  switch (reason.code) {
    case 'vector_score':
    case 'bm25_score':
    case 'keyword_match':
      return null;
    case 'exact_match':
      return 'Tên sản phẩm khớp với nhu cầu tìm kiếm.';
    case 'category_match':
      return 'Đúng nhóm sản phẩm bạn đang tìm.';
    case 'spec_match':
      return 'Thông số phù hợp với yêu cầu kỹ thuật.';
    case 'price_compatible':
      return 'Nằm trong ngân sách đã nêu.';
    case 'in_stock':
      return 'Đang còn hàng.';
    case 'need_match':
      return 'Phù hợp với nhu cầu sử dụng đã nêu.';
    case 'target_user_match':
      return 'Phù hợp với nhóm người dùng mục tiêu.';
    default:
      return null;
  }
}

function specsFromSnapshot(snapshot: {
  searchMetadata?: Record<string, unknown>;
  attributes?: Record<string, unknown>;
}): Record<string, unknown> {
  const normalizedSpecs = snapshot.searchMetadata?.normalizedSpecs;
  if (normalizedSpecs && typeof normalizedSpecs === 'object') {
    return normalizedSpecs as Record<string, unknown>;
  }
  return snapshot.attributes ?? {};
}
