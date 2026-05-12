import { Inject, Injectable, Optional } from '@nestjs/common';

import { AssistantSessionService } from './assistant-session.service';
import { AssistantTraceService } from './assistant-trace.service';
import {
  AssistantIntent,
  AssistantMode,
  AssistantTraceMetadata,
} from './assistant.types';
import { ProductRetriever } from '../retrieval/product-retriever';
import { ProductCatalogAdapter } from './adapters/product-catalog.adapter';
import { ReviewSearchClient } from './adapters/review-search.client';
import { AssistantActionAdapter } from './adapters/assistant-action.adapter';
import { VoucherAdapter } from './adapters/voucher.adapter';
import { OrderLookupAdapter } from './adapters/order.adapter';
import { SupportHandoffAdapter } from './adapters/support-handoff.adapter';
import { StaffHandoffSummaryService } from './staff-handoff-summary.service';
import { staffHandoffNode } from './nodes/staff-handoff.node';
import { shoppingAssistantGraph } from './shopping-assistant.graph';
import { AssistantResponseComposer } from './assistant-response-composer.service';
import { GuardrailService } from './tools/guardrail.service';
import { OrderToolsService } from './tools/order-tools.service';
import { CustomerAssistantProfileService } from './memory/customer-assistant-profile.service';
import { MemoryExtractorService } from './memory/memory-extractor.service';
import { ResponseMergerService } from './response/response-merger.service';

export const SHOPPING_ASSISTANT_GRAPH_INVOKER =
  'SHOPPING_ASSISTANT_GRAPH_INVOKER';

export type InvokeForChatMessageInput = {
  roomId: string;
  authenticatedUserId?: string | null;
  text: string;
  attachments?: unknown[];
  signal?: AbortSignal;
};

export type AssistantServiceResult = {
  status: string;
  text: string;
  metadata: Record<string, unknown>;
};

type GraphInvoker = (
  input: Record<string, unknown>,
  config: Record<string, unknown>,
) => Promise<any>;

const MEMORY_EXTRACTION_SIGNAL_PATTERN =
  /\b(ghi nho|nho la|lan sau|toi thich|minh thich|em thich|khong thich|ngan sach cua toi|so thich)\b/;
const SHOPPING_MEMORY_SIGNAL_PATTERN =
  /\b(ngan sach|tam gia|duoi|toi da|khoang|trieu|gaming|game|hoc|machine learning|ai|van phong|do hoa|render|lap trinh|creator|hieu nang|mong nhe|pin|uu tien|thich|khong thich|ram|ssd|cpu|gpu|vga|rtx|gtx|ryzen|intel|asus|msi|lenovo|acer|dell|hp)\b/;
const MEMORY_EXTRACTION_TIMEOUT_MS = 8_000;

@Injectable()
export class AssistantService {
  constructor(
    private readonly sessionService: AssistantSessionService,
    private readonly traceService: AssistantTraceService,
    @Optional()
    @Inject(SHOPPING_ASSISTANT_GRAPH_INVOKER)
    private readonly graphInvoke: GraphInvoker = shoppingAssistantGraph.invoke.bind(
      shoppingAssistantGraph,
    ) as GraphInvoker,
    @Optional()
    private readonly productRetriever?: ProductRetriever,
    @Optional()
    private readonly catalogAdapter?: ProductCatalogAdapter,
    @Optional()
    private readonly reviewSearchClient?: ReviewSearchClient,
    @Optional()
    private readonly actionAdapter?: AssistantActionAdapter,
    @Optional()
    private readonly voucherAdapter?: VoucherAdapter,
    @Optional()
    private readonly orderLookupAdapter?: OrderLookupAdapter,
    @Optional()
    private readonly handoffAdapter?: SupportHandoffAdapter,
    @Optional()
    private readonly staffHandoffSummaryService?: StaffHandoffSummaryService,
    @Optional()
    private readonly responseComposer?: AssistantResponseComposer,
    @Optional()
    private readonly guardrailService?: GuardrailService,
    @Optional()
    private readonly orderToolsService?: OrderToolsService,
    @Optional()
    private readonly customerProfileService?: CustomerAssistantProfileService,
    @Optional()
    private readonly memoryExtractorService?: MemoryExtractorService,
    @Optional()
    private readonly responseMergerService?: ResponseMergerService,
  ) {}

  async invokeForChatMessage(
    input: InvokeForChatMessageInput,
  ): Promise<AssistantServiceResult> {
    throwIfAborted(input.signal);
    const mode = await this.sessionService.getMode(input.roomId);
    throwIfAborted(input.signal);
    if (mode === AssistantMode.STAFF) {
      return {
        status: 'staff_mode_paused',
        text: '',
        metadata: {
          kind: 'assistant',
          mode: AssistantMode.STAFF,
        },
      };
    }

    await this.sessionService.appendHotMessage(input.roomId, {
      role: 'customer',
      text: input.text,
      createdAt: new Date(),
    });
    throwIfAborted(input.signal);

    const promptContext = await this.buildPromptContextWithProfile(
      input.roomId,
      input.authenticatedUserId,
    );
    throwIfAborted(input.signal);

    const threadId = `ai-chat-${input.roomId}`;
    const result = await this.graphInvoke(
      {
        mode: AssistantMode.AI,
        roomId: input.roomId,
        customerId: input.authenticatedUserId ?? undefined,
        authenticatedUserId: input.authenticatedUserId ?? undefined,
        userText: input.text,
        attachments: input.attachments ?? [],
        promptContext,
      },
      {
        signal: input.signal,
        configurable: {
          thread_id: promptContext.threadId ?? threadId,
          promptContext,
          roomId: input.roomId,
          authenticatedUserId: input.authenticatedUserId ?? undefined,
          abortSignal: input.signal,
          supervisorModel: undefined,
          guardrailService: this.guardrailService,
          sessionService: this.sessionService,
          productRetriever: this.productRetriever,
          catalogAdapter: this.catalogAdapter,
          responseComposer: this.responseComposer,
          reviewSearchClient: this.reviewSearchClient,
          actionAdapter: this.actionAdapter,
          voucherAdapter: this.voucherAdapter,
          orderLookupAdapter: this.orderLookupAdapter,
          orderToolsService: this.orderToolsService,
          handoffAdapter: this.handoffAdapter,
          staffHandoffSummaryService: this.staffHandoffSummaryService,
          responseMergerService: this.responseMergerService,
        },
      },
    );
    throwIfAborted(input.signal);

    const text = result.text ?? '';
    const resultMetadata = (result.metadata ?? {}) as Record<string, unknown>;
    const shouldScheduleMemoryExtraction =
      Boolean(input.authenticatedUserId) &&
      Boolean(this.memoryExtractorService) &&
      Boolean(this.customerProfileService) &&
      this.shouldExtractMemory(resultMetadata, input.text);
    const memoryTraceEvents: AssistantTraceMetadata[] =
      shouldScheduleMemoryExtraction
        ? [
            {
              roomId: input.roomId,
              node: 'memory_extractor',
              memory_extraction_scheduled: true,
              memory_extraction_mode: 'async_best_effort',
            },
          ]
        : [];
    throwIfAborted(input.signal);

    const metadata = {
      kind: 'assistant',
      mode: AssistantMode.AI,
      ...resultMetadata,
      trace: [...(result.traceEvents ?? []), ...memoryTraceEvents].map(
        (event) => this.traceService.redactTraceMetadata(event),
      ),
    };

    if (shouldScheduleMemoryExtraction) {
      this.scheduleMemoryExtractionBestEffort(
        {
          roomId: input.roomId,
          customerId: input.authenticatedUserId ?? undefined,
          userMessage: input.text,
          assistantResponse: text,
        },
        metadata.trace as AssistantTraceMetadata[],
      );
      await Promise.resolve();
      await new Promise<void>((resolve) => setImmediate(resolve));
    }

    if (text) {
      await this.sessionService.appendHotMessage(input.roomId, {
        role: 'assistant',
        text,
        createdAt: new Date(),
        metadata,
      });
    }

    return {
      status: result.status ?? 'completed',
      text,
      metadata,
    };
  }

  async handoffToStaff(input: {
    roomId: string;
    authenticatedUserId: string;
    latestMessage?: string;
    latestMessageId?: string;
  }) {
    if (!this.handoffAdapter) {
      throw new Error('Assistant staff handoff adapter is not configured');
    }
    if (input.latestMessage) {
      await this.sessionService.appendHotMessage(input.roomId, {
        role: 'customer',
        text: input.latestMessage,
        createdAt: new Date(),
      });
    }
    const promptContext = await this.sessionService.buildPromptContext(
      input.roomId,
    );
    return staffHandoffNode(
      {
        roomId: input.roomId,
        customerId: input.authenticatedUserId,
        latestMessage: input.latestMessage,
        latestMessageId: input.latestMessageId,
        intent: AssistantIntent.STAFF_HANDOFF,
        memory: this.toHandoffMemory(promptContext),
      },
      this.handoffAdapter,
      this.staffHandoffSummaryService,
    );
  }

  private async buildPromptContextWithProfile(
    roomId: string,
    customerId?: string | null,
  ) {
    const promptContext = await this.sessionService.buildPromptContext(roomId);
    if (!customerId || !this.customerProfileService) return promptContext;

    const profileSection =
      await this.customerProfileService.buildRedactedPromptSection(customerId);
    if (!profileSection) return promptContext;

    return {
      ...promptContext,
      sections: [
        { kind: 'profileMemory' as const, content: profileSection },
        ...promptContext.sections,
      ],
    };
  }

  private shouldExtractMemory(
    metadata: Record<string, unknown>,
    userText: string,
  ) {
    const normalizedText = normalizeMemorySignalText(userText);
    return (
      metadata.fallback_reason !== 'greeting_guidance' &&
      metadata.memoryRecall !== true &&
      (MEMORY_EXTRACTION_SIGNAL_PATTERN.test(normalizedText) ||
        (isSuccessfulShoppingTurn(metadata) &&
          SHOPPING_MEMORY_SIGNAL_PATTERN.test(normalizedText)))
    );
  }

  private scheduleMemoryExtractionBestEffort(
    input: {
      roomId: string;
      customerId?: string;
      userMessage: string;
      assistantResponse: string;
    },
    trace: AssistantTraceMetadata[],
  ): void {
    void this.extractAndMergeMemory(input).then((events) => {
      for (const event of events) {
        trace.push(this.traceService.redactTraceMetadata({
          memory_extraction_scheduled: true,
          memory_extraction_mode: 'async_best_effort',
          ...event,
        }));
      }
    });
  }

  private async extractAndMergeMemory(input: {
    roomId: string;
    customerId?: string;
    userMessage: string;
    assistantResponse: string;
    signal?: AbortSignal;
  }): Promise<AssistantTraceMetadata[]> {
    if (
      !input.customerId ||
      !this.memoryExtractorService ||
      !this.customerProfileService
    ) {
      return [];
    }

    try {
      if (input.signal?.aborted) return [];
      const currentProfile = await this.customerProfileService.getForPrompt(
        input.customerId,
      );
      if (input.signal?.aborted) return [];
      const controller = new AbortController();
      const extraction = await withTimeout(
        this.memoryExtractorService.extractMemory({
          ...input,
          currentProfile,
          signal: combineAbortSignals(input.signal, controller.signal),
        }),
        MEMORY_EXTRACTION_TIMEOUT_MS,
        () => controller.abort(),
      );
      if (Object.keys(extraction.update).length > 0) {
        await this.customerProfileService.mergeExtractedMemory(
          input.customerId,
          extraction.update,
        );
      }
      return extraction.traceEvents;
    } catch {
      return [
        {
          roomId: input.roomId,
          node: 'memory_extractor',
          memory_extraction_scheduled: true,
          memory_extraction_mode: 'async_best_effort',
          fallback_reason: 'memory_extraction_failed',
          memory_used: [],
        },
      ];
    }
  }

  private toHandoffMemory(promptContext: Record<string, any>) {
    const sectionText = Array.isArray(promptContext.sections)
      ? promptContext.sections
          .map((section) => section.content)
          .filter(Boolean)
          .join('\n')
      : '';
    return {
      roomId: promptContext.roomId,
      transcriptRoomId: promptContext.roomId,
      cartCheckoutContext: sectionText,
    };
  }
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
      reject(new Error('assistant_service_timeout'));
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
  throw new Error('assistant_invocation_aborted');
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

function normalizeMemorySignalText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSuccessfulShoppingTurn(metadata: Record<string, unknown>): boolean {
  return (
    metadata.active_subgraph === 'sales' || Array.isArray(metadata.productCards)
  );
}
