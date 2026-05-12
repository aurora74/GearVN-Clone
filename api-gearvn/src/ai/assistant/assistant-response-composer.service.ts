import { Injectable } from '@nestjs/common';
import { ChatOpenRouter } from '@langchain/openrouter';

import { AssistantProductCard } from './assistant.types';
import { readAssistantModelConfig } from './config/assistant-model.config';

export type ProductAdviceCompositionInput = {
  userText: string;
  productCards: AssistantProductCard[];
  followUpQuestions: string[];
  promptContext?: unknown;
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
        maxTokens: config.maxTokens,
        provider: config.provider,
      });
      const response = await model.invoke(
        [
          {
            role: 'system',
            content: [
              'You are GearVN AI, a practical Vietnamese shopping consultant.',
              'Answer in natural accented Vietnamese and use the conversation context to continue the customer journey.',
              'Use only the provided product cards and follow-up questions.',
              'The productCards array is authoritative; ignore older products or prices in conversationContext when they conflict, and never cite products outside productCards.',
              'Do not invent stock, warranty, discounts, benchmark scores, or specs not present in the cards.',
              'For warranty or policy questions, answer duration or policy only when a product card explicitly includes that fact; if absent, say the catalog does not include it and avoid claims like official warranty, standard warranty, manufacturer terms, or hotline policy.',
              'If product cards are present, briefly explain why the top options fit, using card specs/reasons to make a consultative comparison instead of a template.',
              'If the cards only partially match the customer need, state the tradeoff plainly from the provided cards and offer the most useful next step.',
              'Keep the response concise because product cards render separately.',
            ].join(' '),
          },
          {
            role: 'user',
            content: JSON.stringify({
              customerRequest: redactCustomerPii(input.userText),
              conversationContext: formatPromptContext(input.promptContext),
              productCards: input.productCards.map(toPromptProductCard),
              followUpQuestions: input.followUpQuestions,
              responseGuidance: buildResponseGuidance(input.userText),
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

function toPromptProductCard(product: AssistantProductCard) {
  return {
    name: product.name,
    price: product.price,
    discountPrice: product.discountPrice,
    stock: product.stock,
    availability: product.availability,
    reasons: product.reasons,
    specs: product.specs,
  };
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

function normalizeModelText(response: unknown): string | null {
  const finishReason = finishReasonFromResponse(response);
  if (finishReason === 'length' || finishReason === 'max_tokens') return null;
  const content = contentFromModelResponse(response);
  const text =
    typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content.map(contentPartText).join('')
        : '';

  const trimmed = text.trim();
  if (!trimmed) return null;
  const completeText = trimToCompleteSentence(trimmed, 2400);
  return completeText || null;
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

function trimToCompleteSentence(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const candidate = text.slice(0, maxChars);
  const sentenceEnd = Math.max(
    candidate.lastIndexOf('.'),
    candidate.lastIndexOf('!'),
    candidate.lastIndexOf('?'),
    candidate.lastIndexOf('\n'),
  );
  if (sentenceEnd <= 160) return '';
  return candidate.slice(0, sentenceEnd + 1).trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
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
    .slice(0, 2400);
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
