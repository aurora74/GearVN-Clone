import { Injectable, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AssistantActionDraft,
  AssistantHotMessage,
  AssistantMode,
  AssistantProductCard,
  AssistantProgressiveSummary,
  AssistantRecommendationLedgerEntry,
  AssistantStaffSummary,
} from './assistant.types';
import {
  AssistantSession,
  AssistantSessionDocument,
} from './assistant-session.schema';
import { parseRecommendationRankReference } from './resolvers/recommendation-reference.util';

const HOT_MESSAGE_LIMIT = 8;

export type AssistantPromptContextSection = {
  kind:
    | 'progressiveSummary'
    | 'preferenceNotes'
    | 'cartContext'
    | 'hotMessages'
    | 'pendingActionDrafts'
    | 'profileMemory';
  content: string;
};

export type AssistantPromptContext = {
  roomId: string;
  threadId: string;
  mode: AssistantMode;
  sections: AssistantPromptContextSection[];
};

type AssistantSummaryGenerator = {
  summarize(messages: AssistantHotMessage[]): Promise<AssistantProgressiveSummary>;
};

@Injectable()
export class AssistantSessionService {
  constructor(
    @InjectModel(AssistantSession.name)
    private readonly sessionModel: Model<AssistantSessionDocument>,
    @Optional()
    private readonly summarizer: AssistantSummaryGenerator = defaultSummarizer,
  ) {}

  async getOrCreateSession(roomId: string): Promise<AssistantSessionDocument> {
    const existing = await this.sessionModel.findOne({ roomId }).exec();
    if (existing) return existing;

    const session = new this.sessionModel({
      roomId,
      threadId: buildThreadId(roomId),
      mode: AssistantMode.AI,
      hotMessages: [],
      progressiveSummary: defaultProgressiveSummary(),
      pendingActionDrafts: [],
      staffSummary: null,
      lastRecommendationLedger: [],
      lastSummaryAt: null,
      lastActiveAt: new Date(),
    });
    return session.save();
  }

  async getMode(roomId: string): Promise<AssistantMode> {
    const session = await this.getOrCreateSession(roomId);
    return session.mode;
  }

  async setMode(
    roomId: string,
    mode: AssistantMode,
  ): Promise<AssistantSessionDocument> {
    return this.updateSession(roomId, { mode, lastActiveAt: new Date() });
  }

  async appendHotMessage(
    roomId: string,
    message: AssistantHotMessage,
  ): Promise<AssistantSessionDocument> {
    const session = await this.getOrCreateSession(roomId);
    const hotMessages = [...(session.hotMessages ?? []), message].slice(
      -HOT_MESSAGE_LIMIT,
    );
    const generatedSummary = await this.summarizer.summarize(hotMessages);
    const progressiveSummary = mergeProgressiveSummary(
      session.progressiveSummary ?? defaultProgressiveSummary(),
      generatedSummary,
      hotMessages,
    );

    return this.updateSession(roomId, {
      hotMessages,
      progressiveSummary,
      lastSummaryAt: new Date(),
      lastActiveAt: new Date(),
    });
  }

  async buildPromptContext(roomId: string): Promise<AssistantPromptContext> {
    const session = await this.getOrCreateSession(roomId);
    const summary = session.progressiveSummary ?? defaultProgressiveSummary();

    return {
      roomId,
      threadId: session.threadId ?? buildThreadId(roomId),
      mode: session.mode,
      sections: [
        {
          kind: 'progressiveSummary',
          content: formatProgressiveSummary(summary),
        },
        {
          kind: 'preferenceNotes',
          content: formatPreferenceNotes(summary),
        },
        {
          kind: 'cartContext',
          content: formatCartContext(summary),
        },
        {
          kind: 'hotMessages',
          content: formatHotMessages(session.hotMessages ?? []),
        },
        {
          kind: 'pendingActionDrafts',
          content: JSON.stringify(session.pendingActionDrafts ?? []),
        },
      ],
    };
  }

  async saveActionDraft(
    roomId: string,
    draft: Partial<AssistantActionDraft> & Record<string, unknown>,
  ): Promise<AssistantSessionDocument> {
    await this.getOrCreateSession(roomId);
    const actionDraft = normalizeActionDraft(roomId, draft);

    return this.updateSession(roomId, {
      pendingActionDrafts: [actionDraft],
      lastActiveAt: new Date(),
    });
  }

  async findPendingActionDraft(
    roomId: string,
    draftId: string,
  ): Promise<AssistantActionDraft | null> {
    const session = await this.getOrCreateSession(roomId);
    return (
      (session.pendingActionDrafts ?? []).find((item) => item.draftId === draftId) ??
      null
    );
  }

  async consumeActionDraft(
    roomId: string,
    draftId: string,
  ): Promise<AssistantActionDraft | null> {
    const session = await this.getOrCreateSession(roomId);
    const drafts = session.pendingActionDrafts ?? [];
    const draft = drafts.find((item) => item.draftId === draftId) ?? null;
    if (!draft) return null;

    await this.updateSession(roomId, {
      pendingActionDrafts: drafts.filter((item) => item.draftId !== draftId),
      lastActiveAt: new Date(),
    });
    return draft;
  }

  async recordStaffSummary(
    roomId: string,
    summary: AssistantStaffSummary,
  ): Promise<AssistantSessionDocument> {
    return this.updateSession(roomId, {
      staffSummary: summary,
      mode: AssistantMode.STAFF,
      lastActiveAt: new Date(),
    });
  }

  async saveRecommendationLedger(
    roomId: string,
    cards: Array<Partial<AssistantProductCard> & Record<string, unknown>>,
  ): Promise<AssistantSessionDocument> {
    const createdAt = new Date();
    const lastRecommendationLedger = cards.map((card, index) => ({
      rank: index + 1,
      productId: String(card.productId ?? ''),
      name: String(card.name ?? ''),
      slug: asOptionalString(card.slug),
      normalizedName: normalizedLedgerName(card),
      category: ledgerCategory(card),
      price: asOptionalNumber(card.price),
      discountPrice: asOptionalNumber(card.discountPrice),
      stock: asOptionalNumber(card.stock),
      specsSummary: ledgerSpecsSummary(card),
      createdAt,
    }));

    return this.updateSession(roomId, {
      lastRecommendationLedger,
      lastActiveAt: new Date(),
    });
  }

  async getLastRecommendationLedger(
    roomId: string,
  ): Promise<AssistantRecommendationLedgerEntry[]> {
    const session = await this.sessionModel.findOne({ roomId }).exec();
    return session?.lastRecommendationLedger ?? [];
  }

  async resolveRecommendationReference(
    roomId: string,
    reference: string | number,
  ): Promise<AssistantRecommendationLedgerEntry | null> {
    const session = await this.getOrCreateSession(roomId);
    const rank = parseRecommendationRankReference(reference)?.rank;
    if (!rank) return null;

    return (
      (session.lastRecommendationLedger ?? []).find(
        (item) => item.rank === rank,
      ) ?? null
    );
  }

  private async updateSession(
    roomId: string,
    update: Partial<AssistantSession>,
  ): Promise<AssistantSessionDocument> {
    await this.getOrCreateSession(roomId);
    const updated = await this.sessionModel
      .findOneAndUpdate(
        { roomId },
        { $set: { ...update, roomId } },
        { new: true, runValidators: true },
      )
      .exec();
    return updated ?? this.getOrCreateSession(roomId);
  }
}

function buildThreadId(roomId: string): string {
  return `ai-chat-${roomId}`;
}

function defaultProgressiveSummary(): AssistantProgressiveSummary {
  return {
    need: '',
    shoppingNeed: '',
    budget: '',
    constraints: [],
    constraintsAndSpecs: [],
    discussedProducts: [],
    productsDiscussed: [],
    cartContext: '',
    checkoutContext: '',
    cartCheckoutContext: '',
    orderContext: '',
    unresolvedQuestions: [],
  };
}

const defaultSummarizer: AssistantSummaryGenerator = {
  async summarize(messages) {
    const customerFacts = summarizeCustomerShoppingMemory(messages);
    return {
      ...defaultProgressiveSummary(),
      shoppingNeed: customerFacts.shoppingNeed,
      budget: customerFacts.budget,
      constraintsAndSpecs: customerFacts.constraints,
      constraints: customerFacts.constraints,
      unresolvedQuestions: [],
    };
  },
};

function mergeProgressiveSummary(
  previous: AssistantProgressiveSummary,
  generated: AssistantProgressiveSummary,
  messages: AssistantHotMessage[],
): AssistantProgressiveSummary {
  const customerFacts = summarizeCustomerShoppingMemory(messages);
  const constraints = mergeStringLists(
    previous.constraints,
    previous.constraintsAndSpecs,
    generated.constraints,
    generated.constraintsAndSpecs,
    customerFacts.constraints,
  );

  return {
    ...defaultProgressiveSummary(),
    ...previous,
    ...generated,
    need: latestText(generated.need, previous.need),
    shoppingNeed: mergeMemoryText(
      previous.shoppingNeed,
      generated.shoppingNeed,
      customerFacts.shoppingNeed,
    ),
    budget: latestText(customerFacts.budget, generated.budget, previous.budget),
    constraints,
    constraintsAndSpecs: constraints,
    discussedProducts: mergeStringLists(
      previous.discussedProducts,
      previous.productsDiscussed,
      generated.discussedProducts,
      generated.productsDiscussed,
    ),
    productsDiscussed: mergeStringLists(
      previous.productsDiscussed,
      previous.discussedProducts,
      generated.productsDiscussed,
      generated.discussedProducts,
    ),
    cartContext: latestText(generated.cartContext, previous.cartContext),
    checkoutContext: latestText(generated.checkoutContext, previous.checkoutContext),
    cartCheckoutContext: latestText(
      generated.cartCheckoutContext,
      previous.cartCheckoutContext,
    ),
    orderContext: latestText(generated.orderContext, previous.orderContext),
    unresolvedQuestions: mergeStringLists(
      generated.unresolvedQuestions,
      previous.unresolvedQuestions,
    ),
  };
}

function summarizeCustomerShoppingMemory(messages: AssistantHotMessage[]): {
  shoppingNeed: string;
  budget: string;
  constraints: string[];
} {
  const lines = messages
    .filter((message) => ['customer', 'user'].includes(message.role))
    .map((message) => sanitizeMemoryLine(message.content ?? message.text ?? ''))
    .filter((line) => line && isShoppingMemorySignal(line) && !isRecallLine(line));
  return {
    shoppingNeed: mergeMemoryText(...lines.slice(-6)),
    budget: latestText(...lines.map(extractBudgetText).filter(Boolean).reverse()),
    constraints: mergeStringLists(lines.flatMap(extractConstraintNotes)),
  };
}

function sanitizeMemoryLine(value: string): string {
  return value
    .replace(/^(customer|user|assistant|system):\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isShoppingMemorySignal(line: string): boolean {
  const normalized = normalizeLedgerText(line);
  return /laptop|pc|may tinh|gaming|game|ai|machine learning|deep learning|cad|autocad|ky thuat|gpu|rtx|ngan sach|trieu|tam gia|duoi|toi da|uu tien|do hoa|render|giai tri|xem phim|ram|ssd|cpu|gio hang|checkout|thanh toan|dat hang/.test(
    normalized,
  );
}

function isRecallLine(line: string): boolean {
  return /\b(nho|biet|luu)\b.*(thich|quan tam|nhu cau|gi ve|minh|toi|em)|so thich/.test(
    normalizeLedgerText(line),
  );
}

function extractBudgetText(line: string): string {
  const normalized = normalizeLedgerText(line);
  const match = normalized.match(/(?:ngan sach|tam gia|duoi|toi da|khoang|tam)?\s*(\d{1,3})\s*(?:trieu|tr)\b/);
  return match ? `${match[1]} triệu` : '';
}

function extractConstraintNotes(line: string): string[] {
  const normalized = normalizeLedgerText(line);
  const notes: string[] = [];
  if (/laptop/.test(normalized)) notes.push('laptop');
  if (/\bpc\b|may tinh de ban|may bo|desktop|workstation/.test(normalized))
    notes.push('PC');
  if (/machine learning|deep learning|\bai\b/.test(normalized))
    notes.push('học AI/Machine Learning');
  if (/cad|autocad|ky thuat/.test(normalized)) notes.push('CAD/kỹ thuật');
  if (/do hoa|render/.test(normalized)) notes.push('đồ họa/render');
  if (/giai tri|xem phim/.test(normalized)) notes.push('giải trí');
  if (/gaming|game/.test(normalized)) notes.push('gaming');
  if (/gpu|rtx|cuda/.test(normalized)) notes.push('ưu tiên GPU/RTX');
  return notes;
}

function mergeMemoryText(...values: Array<string | undefined>): string {
  return mergeStringLists(
    ...values.flatMap((value) =>
      cleanMemoryText(value)
        .split(/\n|\|/)
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  )
    .slice(-6)
    .join('\n');
}

function latestText(...values: Array<string | undefined>): string {
  return values.map(cleanMemoryText).find(Boolean) ?? '';
}

function mergeStringLists(
  ...groups: Array<string[] | string | undefined>
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const group of groups) {
    const values = Array.isArray(group) ? group : group ? [group] : [];
    for (const value of values) {
      const cleaned = cleanMemoryText(value);
      const key = normalizeLedgerText(cleaned);
      if (!cleaned || seen.has(key) || isAssistantMemoryLine(cleaned)) continue;
      seen.add(key);
      result.push(cleaned);
    }
  }
  return result;
}

function cleanMemoryText(value?: string): string {
  return value?.replace(/\s+/g, ' ').trim() ?? '';
}

function isAssistantMemoryLine(value: string): boolean {
  const normalized = normalizeLedgerText(value);
  return /^(assistant|system)\b|minh (goi y|da ghi nhan|da them|da chuan bi|co the|khong the|chua thay)|tro ly mua sam/.test(
    normalized,
  );
}

function normalizeActionDraft(
  roomId: string,
  draft: Partial<AssistantActionDraft> & Record<string, unknown>,
): AssistantActionDraft {
  const now = new Date();
  const payload = normalizeActionDraftPayload(draft);
  const action = String(
    draft.action ?? draft.kind ?? draft.intent ?? payload.action ?? 'CART_ACTION',
  );

  return {
    ...draft,
    draftId: String(draft.draftId ?? `draft-${now.getTime()}`),
    roomId,
    customerId: String(draft.customerId ?? ''),
    kind: action,
    action,
    status: draft.status ?? 'pending',
    displayText: String(draft.displayText ?? ''),
    product: draft.product,
    productId: draft.productId ?? payload.productId,
    quantity: draft.quantity ?? payload.quantity,
    voucher: draft.voucher,
    voucherCode: draft.voucherCode ?? payload.voucherCode,
    checkout: draft.checkout ?? (payload.checkout as any),
    redirectPath: draft.redirectPath ?? payload.redirectPath,
    payload,
    requiresConfirmation: draft.requiresConfirmation ?? true,
    confirmedByBackend: draft.confirmedByBackend ?? false,
    createdAt: draft.createdAt ?? now,
    expiresAt:
      draft.expiresAt ?? new Date(now.getTime() + 1000 * 60 * 15),
  } as AssistantActionDraft;
}

function normalizeActionDraftPayload(
  draft: Partial<AssistantActionDraft> & Record<string, unknown>,
): Record<string, unknown> {
  const payload = isRecord(draft.payload) ? { ...draft.payload } : { ...draft };
  delete payload.payload;

  payload.action = draft.action ?? draft.kind ?? draft.intent ?? payload.action;
  payload.productId = draft.productId ?? payload.productId;
  payload.quantity = draft.quantity ?? payload.quantity;
  payload.voucherCode = draft.voucherCode ?? payload.voucherCode;
  payload.checkout = draft.checkout ?? payload.checkout;
  payload.redirectPath = draft.redirectPath ?? payload.redirectPath;

  return payload;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizedLedgerName(
  card: Partial<AssistantProductCard> & Record<string, unknown>,
): string | undefined {
  const searchMetadata = isRecord(card.searchMetadata)
    ? card.searchMetadata
    : undefined;
  return (
    asOptionalString(searchMetadata?.normalizedName) ??
    normalizeLedgerText(String(card.name ?? ''))
  );
}

function ledgerCategory(
  card: Partial<AssistantProductCard> & Record<string, unknown>,
): string | undefined {
  const searchMetadata = isRecord(card.searchMetadata)
    ? card.searchMetadata
    : undefined;
  const categoryPath = searchMetadata?.categoryPath;
  return (
    asOptionalString(card.category) ??
    (Array.isArray(categoryPath) ? asOptionalString(categoryPath[0]) : undefined)
  );
}

function ledgerSpecsSummary(
  card: Partial<AssistantProductCard> & Record<string, unknown>,
): string | undefined {
  const searchMetadata = isRecord(card.searchMetadata)
    ? card.searchMetadata
    : undefined;
  const directSummary =
    asOptionalString(card.specsSummary) ??
    asOptionalString(searchMetadata?.specsSummary);
  if (directSummary) return directSummary;

  const specs = isRecord(card.specs) ? card.specs : undefined;
  if (!specs) return undefined;

  return Object.entries(specs)
    .slice(0, 6)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(', ');
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asOptionalNumber(value: unknown): number | undefined {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function normalizeLedgerText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function formatProgressiveSummary(summary: AssistantProgressiveSummary): string {
  return [
    summary.need,
    summary.shoppingNeed,
    summary.budget,
    ...(summary.constraints ?? summary.constraintsAndSpecs ?? []),
    ...(summary.discussedProducts ?? summary.productsDiscussed ?? []),
    summary.cartContext ?? summary.cartCheckoutContext,
    summary.checkoutContext,
    summary.orderContext,
    ...(summary.unresolvedQuestions ?? []),
  ]
    .filter(Boolean)
    .join('\n');
}

function formatCartContext(summary: AssistantProgressiveSummary): string {
  return [
    summary.cartContext,
    summary.checkoutContext,
    summary.cartCheckoutContext,
    summary.orderContext,
  ]
    .filter(Boolean)
    .join('\n');
}
function formatPreferenceNotes(summary: AssistantProgressiveSummary): string {
  return [
    ...(summary.constraints ?? summary.constraintsAndSpecs ?? []),
    ...(summary.unresolvedQuestions ?? []),
  ].join('\n');
}

function formatHotMessages(messages: AssistantHotMessage[]): string {
  return messages
    .map((message) => `${message.role}: ${message.content ?? message.text ?? ''}`)
    .join('\n');
}
