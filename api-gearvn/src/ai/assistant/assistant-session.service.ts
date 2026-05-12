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
    const progressiveSummary = await this.summarizer.summarize(hotMessages);

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
    return {
      ...defaultProgressiveSummary(),
      unresolvedQuestions: [],
      shoppingNeed: messages
        .map((message) => message.content ?? message.text ?? '')
        .filter(Boolean)
        .slice(-3)
        .join(' | '),
    };
  },
};

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
    summary.need ?? summary.shoppingNeed,
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
