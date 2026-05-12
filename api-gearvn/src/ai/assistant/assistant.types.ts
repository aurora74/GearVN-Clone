export const AssistantMode = {
  AI: 'ai',
  STAFF: 'staff',
} as const;

export type AssistantMode = (typeof AssistantMode)[keyof typeof AssistantMode];

export const AssistantIntent = {
  PRODUCT_ADVICE: 'PRODUCT_ADVICE',
  REVIEW_SUMMARY: 'REVIEW_SUMMARY',
  CART_ACTION: 'CART_ACTION',
  CHECKOUT_PREP: 'CHECKOUT_PREP',
  ORDER_LOOKUP: 'ORDER_LOOKUP',
  STAFF_HANDOFF: 'STAFF_HANDOFF',
  UNSUPPORTED: 'UNSUPPORTED',
} as const;

export type AssistantIntent =
  (typeof AssistantIntent)[keyof typeof AssistantIntent];

export type AssistantActionKind =
  | 'CART_ADD'
  | 'CART_REMOVE'
  | 'CART_SET_QUANTITY'
  | 'APPLY_VOUCHER'
  | 'CHECKOUT_REDIRECT'
  | 'CHECKOUT_PREP'
  | 'ORDER_LOOKUP'
  | 'STAFF_HANDOFF';

export type AssistantSubgraphName = 'sales' | 'order' | 'general';

export type SupervisorDecision = {
  route: AssistantSubgraphName;
  confidence: number;
  intents: AssistantIntent[];
  extractedEntities?: Record<string, unknown>;
  memoryReferences?: AssistantMemoryReference[];
  fallbackReason?: string | null;
};

export type AssistantProductAvailability = {
  status: 'available' | 'out_of_stock' | 'unavailable';
  addable: boolean;
};

export type AssistantProductCard = {
  productId: string;
  name: string;
  slug?: string;
  detailHref: string;
  price?: number;
  discountPrice?: number;
  stock?: number;
  image?: string;
  reasons: string[];
  availability: AssistantProductAvailability;
  actionPayload: {
    productId: string;
    actions: string[];
  };
  specs: Record<string, unknown>;
};

export type AssistantProductDetail = {
  productId: string;
  name: string;
  slug?: string;
  price?: number;
  discountPrice?: number;
  stock?: number;
  category?: string;
  description?: string;
  attributes?: Record<string, unknown>;
  searchMetadata?: Record<string, unknown>;
  averageRating?: number;
  ratingsCount?: number;
  reviewSignals?: Record<string, unknown>;
  specsSummary?: string;
};

export type AssistantRecommendationLedgerEntry = {
  rank: number;
  productId: string;
  name: string;
  slug?: string;
  normalizedName?: string;
  category?: string;
  price?: number;
  discountPrice?: number;
  stock?: number;
  specsSummary?: string;
  createdAt: Date;
};

export type AssistantResolvedProductContext = {
  status: 'resolved' | 'clarification_required' | 'unresolved';
  matchSource?: string;
  confidence?: number;
  product?: AssistantProductDetail | AssistantRecommendationLedgerEntry | null;
  candidates?: Array<AssistantProductDetail | AssistantRecommendationLedgerEntry>;
  clarification?: {
    reason: string;
    text: string;
    candidates: Array<AssistantProductDetail | AssistantRecommendationLedgerEntry>;
  };
};

export type AssistantReviewCitation = {
  title: string;
  url: string;
  source?: string;
};

export type AssistantReviewClaim = {
  text: string;
  evidenceKind: string;
  citations: AssistantReviewCitation[];
  uncertainty?: string;
};

export type AssistantReviewClaimGroup = {
  label: string;
  claims: AssistantReviewClaim[];
};

export type AssistantReviewSummary = {
  productId?: string;
  productName?: string;
  heading: string;
  summary: string;
  repeatedFindings: AssistantReviewClaimGroup;
  needsVerification: AssistantReviewClaimGroup;
  insufficientSources: AssistantReviewClaimGroup;
  citations: AssistantReviewCitation[];
  uncertainty: string[];
};

export type AssistantOrderItem = {
  productId?: string;
  name?: string;
  quantity?: number;
};

export type AssistantOrderCard = {
  orderId: string;
  orderCode?: string;
  status: string;
  paymentStatus?: string;
  total?: number;
  createdAt?: Date | string;
  items?: AssistantOrderItem[];
  detailHref?: string;
};

export type AssistantHandoffMetadata = {
  requested: boolean;
  staffSummaryId?: string;
  ticketId?: string;
};

export type AssistantToolCallTrace = {
  toolName: string;
  subgraph?: AssistantSubgraphName;
  status: 'success' | 'error' | 'skipped';
  latencyMs?: number;
  inputSummary?: string;
  outputSummary?: string;
  errorCode?: string;
};

export type AssistantMemoryReference = {
  memoryId?: string;
  kind: 'preference' | 'contact' | 'address' | 'product' | 'use_case' | string;
  label: string;
  confidence?: number;
  redactedValue?: string;
};

export type AssistantGuardrailDecision = {
  rule: string;
  action: 'allow' | 'block' | 'revise' | 'handoff';
  reason?: string;
  subgraph?: AssistantSubgraphName;
};

export type AssistantResponseMergeTrace = {
  strategy: 'single' | 'priority' | 'merge' | 'fallback' | string;
  sourceSubgraphs: AssistantSubgraphName[];
  preservedMetadata: string[];
  droppedMetadata?: string[];
  reason?: string;
};

export type AssistantCheckoutReviewCard = {
  name?: string;
  phoneMasked?: string;
  addressPreview?: string;
  missingFields: string[];
  actions: Array<'confirm' | 'edit' | string>;
};

export type AssistantCheckoutDetails = {
  name?: string;
  phone?: string;
  address?: string;
};

export type AssistantActionDraft = {
  draftId: string;
  roomId: string;
  customerId: string;
  kind: AssistantActionKind | string;
  displayText: string;
  payload: Record<string, unknown>;
  checkout?: AssistantCheckoutDetails;
  requiresConfirmation: boolean;
  createdAt: Date;
  expiresAt: Date;
};

export type AssistantMessageMetadata = {
  kind: 'assistant';
  mode: AssistantMode;
  productCards: AssistantProductCard[];
  reviewSummary: AssistantReviewSummary | null;
  orderCards: AssistantOrderCard[];
  actionDrafts: AssistantActionDraft[];
  actionDraft?: AssistantActionDraft | null;
  handoff: AssistantHandoffMetadata | null;
  unsupportedReason: string | null;
  traceId: string;
  checkoutReview?: AssistantCheckoutReviewCard | null;
  reviewCitations?: AssistantReviewCitation[];
  memoryReferences?: AssistantMemoryReference[];
  guardrails?: AssistantGuardrailDecision[];
  responseMerge?: AssistantResponseMergeTrace | null;
  activeSubgraph?: AssistantSubgraphName;
  supervisorDecision?: SupervisorDecision;
  trace?: AssistantToolCallTrace[];
};

export type AssistantHotMessage = {
  role: 'user' | 'customer' | 'assistant' | 'staff' | 'system';
  text?: string;
  content?: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
};

export type AssistantProgressiveSummary = {
  shoppingNeed?: string;
  need?: string;
  budget?: string;
  constraintsAndSpecs?: string[];
  constraints?: string[];
  productsDiscussed?: string[];
  discussedProducts?: string[];
  cartCheckoutContext?: string;
  cartContext?: string;
  checkoutContext?: string;
  orderContext?: string;
  unresolvedQuestions?: string[];
};

export type AssistantStaffSummary = {
  summaryId: string;
  text: string;
  createdAt: Date;
};

export type AssistantTraceMetadata = {
  traceId?: string;
  roomId?: string;
  node?: string;
  intent?: AssistantIntent;
  latencyMs?: number;
  tokenCount?: number;
  model?: string;
  errorCode?: string;
  safety?: Record<string, boolean>;
  supervisor_decision?: Record<string, unknown>;
  active_subgraph?: AssistantSubgraphName;
  tool_calls?: AssistantToolCallTrace[];
  retrieval_query?: string;
  crag_retry?: boolean | number | Record<string, unknown>;
  memory_used?: AssistantMemoryReference[] | boolean;
  response_merge?: AssistantResponseMergeTrace;
  guardrail_decision?: AssistantGuardrailDecision | AssistantGuardrailDecision[];
  model_name?: string;
  latency_ms?: number;
  fallback_reason?: string;
  [key: string]: unknown;
};
