import type { CartItemType } from "./order";

export type Sender = "CUSTOMER" | "ADMIN" | string;

export type AssistantMode = "ai" | "staff";

export type AssistantSubgraphName = "sales" | "order" | "general";
export type AssistantProductConsultationMode =
  | "initial_advice"
  | "refinement"
  | "more_options"
  | "price_sort"
  | "combo_advice";

export type AssistantRecommendationContinuityMetadata = {
  mode: AssistantProductConsultationMode;
  hasPriorRecommendations: boolean;
  priorRecommendationProductIds: string[];
  comparedProductIds: string[];
  preferenceDelta?: string;
};

export type AssistantActionKind =
  | "CART_ADD"
  | "CART_REMOVE"
  | "CART_SET_QUANTITY"
  | "APPLY_VOUCHER"
  | "CHECKOUT_REDIRECT"
  | "CHECKOUT_PREP"
  | "ORDER_LOOKUP"
  | "STAFF_HANDOFF"
  | string;

export type AssistantProductAvailability = {
  status: "available" | "out_of_stock" | "unavailable";
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
  createdAt?: string;
  items?: AssistantOrderItem[];
  detailHref?: string;
};

export type AssistantCheckoutDetails = {
  name?: string;
  phone?: string;
  address?: string;
};

export type AssistantActionDraft = {
  draftId: string;
  roomId: string;
  customerId?: string;
  kind: AssistantActionKind;
  action?: AssistantActionKind;
  displayText: string;
  payload?: unknown;
  checkout?: AssistantCheckoutDetails;
  productId?: string;
  quantity?: number;
  voucherCode?: string;
  redirectPath?: string;
  requiresConfirmation: true;
  confirmedByBackend?: false;
  createdAt?: string;
  expiresAt?: string;
};

export type AssistantHandoffStatus = {
  requested: boolean;
  ticketId?: string;
};

export type AssistantMemoryReference = {
  memoryId?: string;
  kind: string;
  label: string;
  confidence?: number;
  redactedValue?: string;
};

export type AssistantGuardrailDecision = {
  rule: string;
  action: "allow" | "block" | "revise" | "handoff" | string;
  reason?: string;
  subgraph?: AssistantSubgraphName;
};

export type AssistantResponseMergeTrace = {
  strategy: string;
  sourceSubgraphs: AssistantSubgraphName[];
  preservedMetadata: string[];
  droppedMetadata?: string[];
  reason?: string;
};

export type AssistantCheckoutReviewCard = {
  name?: string;
  phoneMasked?: string;
  addressPreview?: string;
  phone?: string;
  address?: string;
  missingFields: string[];
  actions: string[];
};

export type SupervisorDecision = {
  route: AssistantSubgraphName;
  confidence: number;
  intents: string[];
  extractedEntities?: Record<string, unknown>;
  memoryReferences?: AssistantMemoryReference[];
  fallbackReason?: string | null;
};

export type AssistantConfirmedAction = {
  draftId: string;
  action: AssistantActionKind;
  kind?: AssistantActionKind;
  displayText: string;
  productId?: string;
  quantity?: number;
  cartItem?: CartItemType;
  product?: AssistantProductCard;
  voucherCode?: string;
  checkout?: unknown;
  redirectPath?: string;
  confirmedByBackend: true;
};

export type AssistantMessageMetadata = {
  kind: "assistant" | "assistant-action-confirmed";
  mode?: AssistantMode;
  productCards?: AssistantProductCard[];
  reviewSummary?: AssistantReviewSummary | null;
  orderCards?: AssistantOrderCard[];
  actionDrafts?: AssistantActionDraft[];
  actionDraft?: AssistantActionDraft | null;
  handoff?: AssistantHandoffStatus | null;
  unsupportedReason?: string | null;
  traceId?: string;
  confirmed?: AssistantConfirmedAction;
  checkoutReview?: AssistantCheckoutReviewCard | null;
  reviewCitations?: AssistantReviewCitation[];
  memoryReferences?: AssistantMemoryReference[];
  guardrails?: AssistantGuardrailDecision[];
  responseMerge?: AssistantResponseMergeTrace | null;
  activeSubgraph?: AssistantSubgraphName;
  supervisorDecision?: SupervisorDecision;
  consultationMode?: AssistantProductConsultationMode;
  priorRecommendationProductIds?: string[];
  comparedProductIds?: string[];
  recommendationContinuity?: AssistantRecommendationContinuityMetadata;
  llmComposeStatus?: "skipped" | "used" | "fallback";
  llmComposeFallbackReason?: string;
  error?: {
    code?: string;
    message?: string;
  };
};

export type UserInfo = {
  _id: string;
  fullName: string;
  avatarUrl?: string;
};

export type User = {
  _id: string;
  fullName: string;
  avatarUrl?: string;

  messages: Message[];

  time: string;
  online: boolean;
  typing: boolean;
  newMessage: string;
  unreadCount: number;
};

export type Message = {
  _id: string;
  text: string;
  roomId: string;
  createdAt: string;
  unreadCount: number;
  attachments: string[];

  sender: Sender;
  userId: UserInfo;

  isRead: boolean;
  isDefault?: boolean;
  isDeleted: boolean;
  messageKind?: "chat" | "assistant" | "system";
  metadata?: AssistantMessageMetadata;
};

export type UseMessageParams = {
  roomId?: string;
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
};
