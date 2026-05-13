import { Injectable } from '@nestjs/common';
import { ChatOpenRouter } from '@langchain/openrouter';

import {
  AssistantPriorRecommendationContext,
  AssistantProductCard,
  AssistantProductConsultationMode,
} from './assistant.types';
import { readAssistantModelConfig } from './config/assistant-model.config';

export type ProductAdviceCompositionInput = {
  userText: string;
  productCards: AssistantProductCard[];
  followUpQuestions: string[];
  promptContext?: unknown;
  priorRecommendations?: AssistantPriorRecommendationContext[];
  preferenceDelta?: string;
  consultationMode?: AssistantProductConsultationMode;
  slotCoverage?: {
    requestedSlots: string[];
    coveredSlots: string[];
    missingSlots: string[];
  };
  signal?: AbortSignal;
};

export type ProductClarificationCompositionInput = {
  userText: string;
  followUpQuestions: string[];
  promptContext?: unknown;
  signal?: AbortSignal;
};

@Injectable()
export class AssistantResponseComposer {
  async composeProductAdvice(
    input: ProductAdviceCompositionInput,
  ): Promise<string | null> {
    const config = readAssistantModelConfig().openRouter;
    const apiKey = config.apiKey ?? process.env.OPENROUTER_API_KEY;
    if (!apiKey || input.productCards.length === 0) return null;

    try {
      const model = new (ChatOpenRouter as any)({
        apiKey,
        model: config.chatModel,
        temperature: config.temperature,
        maxTokens: productAdviceMaxTokens(config.maxTokens),
        provider: config.provider,
      });
      const response = await model.invoke(
        [
          {
            role: 'system',
            content: [
              'You are GearVN AI, a concise Vietnamese shopping consultant.',
              'Return only strict JSON with a string field named "message".',
              'Write the message in natural accented Vietnamese using only supplied productCards and priorRecommendations facts.',
              'When consultationMode is refinement, continue the prior consultation: compare the current productCards with priorRecommendations, explain what changed because of preferenceDelta, and do not pretend this is a new isolated request.',
              'Product cards render separately; do not claim a total number of products.',
              'Use 3-4 short sentences, no table, no markdown.',
              'Mention one grounded tradeoff only if useful, and ask at most one follow-up question.',
              'Do not invent stock, warranty, discounts, benchmarks, or specs.',
            ].join(' '),
          },
          {
            role: 'user',
            content: JSON.stringify({
              customerRequest: redactCustomerPii(input.userText),
              conversationContext: formatPromptContext(input.promptContext),
              productCards: input.productCards
                .slice(0, 3)
                .map((product) => toPromptProductCard(product, input.userText)),
              priorRecommendations: (input.priorRecommendations ?? [])
                .slice(0, 5)
                .map((product) =>
                  toPromptPriorRecommendation(product, input.userText),
                ),
              preferenceDelta: input.preferenceDelta
                ? redactCustomerPii(input.preferenceDelta)
                : undefined,
              consultationMode: input.consultationMode ?? 'initial_advice',
              slotCoverage: input.slotCoverage,
              catalogGapGuidance: buildCatalogGapGuidance(input.slotCoverage),
              followUpQuestions: input.followUpQuestions,
              responseGuidance: buildResponseGuidance(input.userText),
              outputSchema: { message: 'Vietnamese advice text' },
            }),
          },
        ],
        {
          ...(input.signal ? { signal: input.signal } : {}),
          response_format: { type: 'json_object' },
        },
      );

      return extractProductAdviceMessage(response);
    } catch {
      return null;
    }
  }

  async composeProductClarification(
    input: ProductClarificationCompositionInput,
  ): Promise<string | null> {
    const config = readAssistantModelConfig().openRouter;
    const apiKey = config.apiKey ?? process.env.OPENROUTER_API_KEY;
    if (!apiKey || input.followUpQuestions.length === 0) return null;

    try {
      const model = new (ChatOpenRouter as any)({
        apiKey,
        model: config.chatModel,
        temperature: config.temperature,
        maxTokens: Math.min(config.maxTokens, 700),
        provider: config.provider,
      });
      const response = await model.invoke(
        [
          {
            role: 'system',
            content: [
              'You are GearVN AI, a practical Vietnamese shopping consultant.',
              'The customer has asked a broad product-advice question without enough constraints.',
              'Ask concise, natural Vietnamese follow-up questions before recommending products.',
              'Use the conversation context to avoid repeating questions already answered.',
              'Do not mention implementation details, retrieval, tools, or model behavior.',
              'Keep the answer to one short paragraph or a compact list.',
            ].join(' '),
          },
          {
            role: 'user',
            content: JSON.stringify({
              customerRequest: redactCustomerPii(input.userText),
              conversationContext: formatPromptContext(input.promptContext),
              requiredFollowUpQuestions: input.followUpQuestions,
            }),
          },
        ],
        input.signal ? { signal: input.signal } : undefined,
      );

      return normalizeModelText(response);
    } catch {
      return null;
    }
  }
}

function toPromptProductCard(
  product: AssistantProductCard,
  customerRequest?: string,
) {
  return {
    productId: product.productId,
    name: product.name,
    price: product.price,
    discountPrice: product.discountPrice,
    stock: product.stock,
    availability: product.availability,
    reasons: product.reasons.slice(0, 3),
    specs: compactPromptSpecs(product.specs, customerRequest),
  };
}

function toPromptPriorRecommendation(
  product: AssistantPriorRecommendationContext,
  customerRequest?: string,
) {
  return {
    rank: product.rank,
    productId: product.productId,
    name: product.name,
    category: product.category,
    price: product.price,
    discountPrice: product.discountPrice,
    stock: product.stock,
    reasons: (product.reasons ?? []).slice(0, 3),
    specsSummary: product.specsSummary,
    specs: compactPromptSpecs(product.specs, customerRequest),
  };
}

function compactPromptSpecs(
  specs: Record<string, unknown> | undefined,
  customerRequest?: string,
) {
  if (!specs || typeof specs !== 'object') return {};
  const entries = Object.entries(specs).filter(
    ([, value]) =>
      value !== undefined && value !== null && String(value).trim(),
  );
  const normalizedRequest = normalizeAdviceText(customerRequest ?? '');
  const priority = entries.filter(([key]) =>
    isQueryRelevantSpecKey(key, normalizedRequest),
  );
  const remaining = entries.filter(
    ([key]) => !isQueryRelevantSpecKey(key, normalizedRequest),
  );

  return Object.fromEntries(
    [...priority, ...remaining]
      .slice(0, 8)
      .map(([key, value]) => [key, String(value).slice(0, 120)]),
  );
}

function buildCatalogGapGuidance(
  slotCoverage?: ProductAdviceCompositionInput['slotCoverage'],
): string | undefined {
  const missingSlots = slotCoverage?.missingSlots ?? [];
  if (missingSlots.length === 0) return undefined;
  const labels = missingSlots.map(slotGapLabel);
  const desktopGuard = missingSlots.includes('desktop_pc')
    ? ' Do not replace an assembled desktop PC gap with components or unrelated products.'
    : '';
  return `Explicitly state the catalog has no suitable option for: ${labels.join(', ')}.${desktopGuard}`;
}

function slotGapLabel(slot: string): string {
  switch (slot) {
    case 'desktop_pc':
      return 'assembled desktop PC / PC bộ';
    case 'desk':
      return 'desk / bàn';
    case 'chair':
      return 'chair / ghế';
    default:
      return slot.replace(/_/g, ' ');
  }
}

function buildResponseGuidance(userText: string): string | undefined {
  const normalized = normalizeAdviceText(userText);
  if (/bao hanh|warranty|chinh sach/.test(normalized)) {
    return [
      'The customer is asking about warranty or policy details.',
      'If the provided product cards do not contain explicit warranty duration or policy fields, state that the catalog does not include that detail.',
      'Do not repeat a full comparison unless needed to identify the products, and do not claim official/standard/manufacturer warranty terms from general knowledge.',
    ].join(' ');
  }

  return undefined;
}

function normalizeAdviceText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractProductAdviceMessage(response: unknown): string | null {
  const structuredMessage = productAdviceMessageFromStructured(response);
  if (structuredMessage) return structuredMessage;

  const finishReason = finishReasonFromResponse(response);
  for (const candidate of productAdviceTextCandidates(response)) {
    const text = stripJsonFence(candidate.trim());
    if (!text) continue;

    const parsed = parseJsonObject(text);
    const parsedMessage = parsed
      ? productAdviceMessageFromParsed(parsed)
      : null;
    if (parsedMessage) return parsedMessage;

    if (looksLikeJson(text)) continue;

    const completeText = trimToCompleteSentence(text, 900);
    if (completeText) return completeText;
    if (finishReason === 'length' || finishReason === 'max_tokens') continue;
  }

  return null;
}

function productAdviceMessageFromStructured(response: unknown): string | null {
  if (!isRecord(response)) return null;

  const directMessage = productAdviceMessageFromParsed(response);
  if (directMessage) return directMessage;

  const wrappedCandidates = [
    response.parsed,
    response.response_metadata,
    response.additional_kwargs,
    response.generationInfo,
    response.kwargs,
  ];

  for (const candidate of wrappedCandidates) {
    if (!isRecord(candidate)) continue;
    const message = productAdviceMessageFromParsed(candidate);
    if (message) return message;
    if (isRecord(candidate.parsed)) {
      const parsedMessage = productAdviceMessageFromParsed(candidate.parsed);
      if (parsedMessage) return parsedMessage;
    }
  }

  return null;
}

function productAdviceMessageFromParsed(
  parsed: Record<string, unknown>,
): string | null {
  const message =
    typeof parsed.message === 'string'
      ? parsed.message
      : Array.isArray(parsed.sentences)
        ? parsed.sentences
            .filter(
              (sentence): sentence is string => typeof sentence === 'string',
            )
            .join(' ')
        : '';
  const trimmed = message.trim();
  if (!trimmed) return null;

  return trimToCompleteSentence(trimmed, 900) || null;
}

function productAdviceTextCandidates(response: unknown): string[] {
  const candidates: string[] = [];
  const content = contentFromModelResponse(response);
  const contentText = textFromModelContent(content);
  if (contentText) candidates.push(contentText);

  if (typeof response === 'string' && response !== contentText) {
    candidates.push(response);
  }

  return uniqueTextCandidates(candidates);
}

function normalizeModelText(response: unknown): string | null {
  const trimmed = rawModelText(response).trim();
  if (!trimmed) return null;

  const finishReason = finishReasonFromResponse(response);
  const completeText = trimToCompleteSentence(trimmed, 1400);
  if (finishReason === 'length' || finishReason === 'max_tokens') {
    return completeText || null;
  }
  return completeText || null;
}

function rawModelText(response: unknown): string {
  return textFromModelContent(contentFromModelResponse(response));
}

function textFromModelContent(content: unknown): string {
  return typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content.map(contentPartText).join('')
      : isRecord(content)
        ? (productAdviceMessageFromParsed(content) ?? '')
        : '';
}

function contentFromModelResponse(response: unknown): unknown {
  return isRecord(response) && 'content' in response
    ? response.content
    : response;
}

function contentPartText(part: unknown): string {
  if (typeof part === 'string') return part;
  if (!isRecord(part)) return '';
  return typeof part.text === 'string' ? part.text : '';
}

function finishReasonFromResponse(response: unknown): string | undefined {
  if (!isRecord(response)) return undefined;
  const candidates = [
    response.response_metadata,
    response.additional_kwargs,
    response.generationInfo,
  ];
  for (const candidate of candidates) {
    if (isRecord(candidate) && typeof candidate.finish_reason === 'string') {
      return candidate.finish_reason;
    }
  }
  return undefined;
}

function productAdviceMaxTokens(configuredMaxTokens: number): number {
  return Math.min(Math.max(configuredMaxTokens, 450), 700);
}

function trimToCompleteSentence(text: string, maxChars: number): string {
  const candidate = (
    text.length <= maxChars ? text : text.slice(0, maxChars)
  ).trim();
  if (!candidate) return '';
  if (/[.!?…]$/.test(candidate)) return candidate;

  const sentenceEnd = Math.max(
    candidate.lastIndexOf('.'),
    candidate.lastIndexOf('!'),
    candidate.lastIndexOf('?'),
    candidate.lastIndexOf('…'),
    candidate.lastIndexOf('\n'),
  );
  if (sentenceEnd <= 160) return '';
  return candidate.slice(0, sentenceEnd + 1).trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  return trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function looksLikeJson(text: string): boolean {
  return /^[\[{]/.test(text.trim());
}

function uniqueTextCandidates(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function isQueryRelevantSpecKey(
  key: string,
  normalizedRequest: string,
): boolean {
  const normalizedKey = normalizeAdviceText(key);
  if (!normalizedKey) return false;
  const wantsBattery = /pin|battery|wh/.test(normalizedRequest);
  const wantsPerformance =
    /gaming|game|ai|machine learning|ml|rtx|gpu|vga|do hoa/.test(
      normalizedRequest,
    );
  const wantsMonitor =
    /man hinh|monitor|2k|qhd|ips|oled|hz|tan so|do phan giai/.test(
      normalizedRequest,
    );
  const wantsThinLight = /mong nhe|thin|light|di chuyen|can nang|weight/.test(
    normalizedRequest,
  );

  return (
    (wantsBattery && /pin|battery|wh/.test(normalizedKey)) ||
    (wantsPerformance &&
      /gpu|vga|card|graphics|cpu|processor|chip|ram|memory|ssd|storage|o cung/.test(
        normalizedKey,
      )) ||
    (wantsMonitor &&
      /resolution|do phan giai|panel|tam nen|ips|oled|hz|tan so|inch|kich thuoc/.test(
        normalizedKey,
      )) ||
    (wantsThinLight &&
      /weight|can nang|kg|dimension|kich thuoc|do mong|mong/.test(
        normalizedKey,
      ))
  );
}

function formatPromptContext(promptContext: unknown): string {
  const sections = promptContextSections(promptContext);
  if (sections.length === 0) return '';

  const priority = [
    'profileMemory',
    'preferenceNotes',
    'progressiveSummary',
    'cartContext',
    'hotMessages',
  ];
  return priority
    .map((kind) => {
      const content = sections.find(
        (section) => section.kind === kind,
      )?.content;
      return content ? `[${kind}]\n${redactCustomerPii(content)}` : '';
    })
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 500);
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
