import { Inject, Injectable, Optional } from '@nestjs/common';
import { ChatOpenRouter } from '@langchain/openrouter';

import {
  AssistantMemoryReference,
  AssistantTraceMetadata,
} from '../assistant.types';
import { readAssistantModelConfig } from '../config/assistant-model.config';
import { CustomerAssistantPromptProfile } from './customer-assistant-profile.service';
import {
  MemoryExtraction,
  MemoryExtractionJsonSchema,
  MemoryExtractionSchema,
} from './memory-extractor.schema';

const MIN_FIELD_CONFIDENCE = 0.65;

type MemoryExtractorModel = {
  invoke(
    messages: Array<{ role: string; content: string }>,
    options?: { signal?: AbortSignal },
  ): Promise<unknown>;
};

export type ExtractMemoryInput = {
  customerId?: string | null;
  roomId: string;
  userMessage: string;
  assistantResponse: string;
  currentProfile?: CustomerAssistantPromptProfile | null;
  signal?: AbortSignal;
};

export type ExtractMemoryResult = {
  update: Partial<MemoryExtraction>;
  memoryReferences: AssistantMemoryReference[];
  traceEvents: AssistantTraceMetadata[];
  ignoredReason?: string;
};

export const MEMORY_EXTRACTOR_MODEL = 'MEMORY_EXTRACTOR_MODEL';

@Injectable()
export class MemoryExtractorService {
  constructor(
    @Optional()
    @Inject(MEMORY_EXTRACTOR_MODEL)
    private readonly model?: MemoryExtractorModel,
  ) {}

  async extractMemory(input: ExtractMemoryInput): Promise<ExtractMemoryResult> {
    if (!input.customerId) {
      return emptyResult(input.roomId, 'missing_customerId');
    }

    const raw = await this.invokeExtractor(input);
    const parsed = MemoryExtractionSchema.parse(normalizeRawExtraction(raw));
    const update = sanitizeExtraction(parsed, input.userMessage);
    const memoryReferences = buildTraceSafeMemoryReferences(
      update,
      parsed.confidence,
    );

    return {
      update,
      memoryReferences,
      traceEvents: [
        {
          roomId: input.roomId,
          node: 'memory_extractor',
          memory_used: memoryReferences,
        },
      ],
      ignoredReason: parsed.ignoredReason || undefined,
    };
  }

  private async invokeExtractor(input: ExtractMemoryInput): Promise<unknown> {
    const model = this.model ?? createOpenRouterMemoryModel();
    if (!model) {
      return heuristicExtraction(input.userMessage);
    }

    const response = await model.invoke(
      [
        {
          role: 'system',
          content: [
            'You extract durable customer shopping memory for GearVN.',
            'Return strict JSON only.',
            'Only extract values the customer explicitly states.',
            'Do not infer private contact data.',
            'Use confidence per populated field from 0 to 1.',
          ].join(' '),
        },
        {
          role: 'user',
          content: [
            `Customer message: ${input.userMessage}`,
            `Current redacted profile: ${JSON.stringify(input.currentProfile ?? {})}`,
          ].join('\n'),
        },
      ],
      input.signal ? { signal: input.signal } : undefined,
    );

    return (response as any)?.content ?? response;
  }
}

function createOpenRouterMemoryModel(): MemoryExtractorModel | null {
  const config = readAssistantModelConfig().openRouter;
  const apiKey = config.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  return new (ChatOpenRouter as any)({
    apiKey,
    model: config.chatModel,
    temperature: Math.min(config.temperature, 0.1),
    maxTokens: config.maxTokens,
    provider: config.provider,
    modelKwargs: {
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'gearvn_memory_extraction',
          strict: true,
          schema: MemoryExtractionJsonSchema,
        },
      },
    },
  });
}

function normalizeRawExtraction(raw: unknown): unknown {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return { ignoredReason: 'invalid_json' };
    }
  }
  return raw && typeof raw === 'object'
    ? raw
    : { ignoredReason: 'empty_output' };
}

function sanitizeExtraction(
  extraction: MemoryExtraction,
  userMessage: string,
): Partial<MemoryExtraction> {
  const explicit = new Set(extraction.explicitFields);
  const confidence = extraction.confidence;
  const groundedUserText = normalizeGroundingText(userMessage);
  const update: Partial<MemoryExtraction> = {};

  for (const field of [
    'preferences',
    'brandPreferences',
    'useCases',
    'productsOfInterest',
  ] as const) {
    if (!explicit.has(field) || !fieldIsConfident(confidence, field)) continue;
    const values = cleanStringArray(extraction[field]).filter((value) =>
      isGroundedInUserMessage(field, value, groundedUserText),
    );
    if (values.length) update[field] = values;
  }

  if (
    explicit.has('budgetRange') &&
    fieldIsConfident(confidence, 'budgetRange')
  ) {
    const budgetRange = cleanText(extraction.budgetRange);
    if (
      budgetRange &&
      isGroundedInUserMessage('budgetRange', budgetRange, groundedUserText)
    ) {
      update.budgetRange = budgetRange;
    }
  }

  if (explicit.has('name') && fieldIsConfident(confidence, 'name')) {
    const name = cleanText(extraction.name);
    if (name && isGroundedInUserMessage('name', name, groundedUserText)) {
      update.name = name;
    }
  }

  if (explicit.has('phone') && fieldIsConfident(confidence, 'phone')) {
    const phone = normalizePhone(extraction.phone);
    if (phone && isGroundedInUserMessage('phone', phone, groundedUserText)) {
      update.phone = phone;
    }
  }

  if (explicit.has('address') && fieldIsConfident(confidence, 'address')) {
    const address = normalizeAddress(extraction.address);
    if (
      address &&
      isGroundedInUserMessage('address', address, groundedUserText)
    ) {
      update.address = address;
    }
  }

  if (
    explicit.has('specPreferences') &&
    fieldIsConfident(confidence, 'specPreferences')
  ) {
    const specPreferences = cleanSpecPreferences(extraction.specPreferences);
    const filteredSpecPreferences = Object.fromEntries(
      Object.entries(specPreferences).filter(([key, value]) =>
        isGroundedInUserMessage(
          'specPreferences',
          `${key} ${String(value)}`,
          groundedUserText,
        ),
      ),
    );
    if (Object.keys(filteredSpecPreferences).length)
      update.specPreferences = filteredSpecPreferences;
  }

  return update;
}

function fieldIsConfident(
  confidence: Record<string, number>,
  field: string,
): boolean {
  return (confidence[field] ?? 0) >= MIN_FIELD_CONFIDENCE;
}

function cleanStringArray(values: string[]): string[] {
  return Array.from(new Set(values.map(cleanText).filter(Boolean)));
}

function cleanText(value?: string): string {
  return value?.replace(/\s+/g, ' ').trim() ?? '';
}

function normalizePhone(value?: string): string {
  const digits = value?.replace(/\D/g, '') ?? '';
  if (digits.length < 9 || digits.length > 11) return '';
  return digits;
}

function normalizeAddress(value?: string): string {
  return cleanText(value).slice(0, 240);
}

function cleanSpecPreferences(
  value: Record<string, unknown>,
): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) =>
      ['string', 'number', 'boolean'].includes(typeof item),
    ),
  ) as Record<string, string | number | boolean>;
}

function normalizeGroundingText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isGroundedInUserMessage(
  field: string,
  value: string,
  groundedUserText: string,
): boolean {
  if (!groundedUserText || !value) return false;
  const normalizedValue = normalizeGroundingText(value);
  if (!normalizedValue) return false;

  if (field === 'phone') {
    const digits = value.replace(/\D/g, '');
    return (
      Boolean(digits) && groundedUserText.replace(/\D/g, '').includes(digits)
    );
  }

  if (field === 'address') {
    const tokens = normalizedValue
      .split(' ')
      .filter((token) => token.length >= 3);
    return tokens.some((token) => groundedUserText.includes(token));
  }

  if (field === 'name') {
    return groundedUserText.includes(normalizedValue);
  }

  if (field === 'budgetRange') {
    return (
      /\d/.test(normalizedValue) && groundedUserText.includes(normalizedValue)
    );
  }

  if (field === 'specPreferences') {
    return normalizedValue
      .split(' ')
      .filter((token) => token.length >= 2)
      .some((token) => groundedUserText.includes(token));
  }

  return normalizedUserMessageContainsValue(groundedUserText, normalizedValue);
}

function normalizedUserMessageContainsValue(
  groundedUserText: string,
  normalizedValue: string,
): boolean {
  return normalizedValue
    .split(' ')
    .filter((token) => token.length >= 3)
    .some((token) => groundedUserText.includes(token));
}

function buildTraceSafeMemoryReferences(
  update: Partial<MemoryExtraction>,
  confidence: Record<string, number>,
): AssistantMemoryReference[] {
  const references: AssistantMemoryReference[] = [];
  const add = (
    field: string,
    kind: AssistantMemoryReference['kind'],
    label: string,
    redactedValue?: string,
  ) => {
    if (update[field as keyof MemoryExtraction] === undefined) return;
    references.push({
      kind,
      label,
      confidence: confidence[field],
      redactedValue,
    });
  };

  add('preferences', 'preference', 'preferences');
  add('budgetRange', 'preference', 'budgetRange');
  add('brandPreferences', 'preference', 'brandPreferences');
  add('useCases', 'use_case', 'useCases');
  add('specPreferences', 'preference', 'specPreferences');
  add('productsOfInterest', 'product', 'productsOfInterest');
  add('name', 'contact', 'name', update.name ? '[saved-name]' : undefined);
  add(
    'phone',
    'contact',
    'phone',
    update.phone ? maskPhone(update.phone) : undefined,
  );
  add(
    'address',
    'address',
    'address',
    update.address ? previewAddress(update.address) : undefined,
  );

  return references;
}

function maskPhone(phone?: string): string | undefined {
  const digits = phone?.replace(/\D/g, '') ?? '';
  if (digits.length < 4) return undefined;
  return `${digits.slice(0, 3)}****${digits.slice(-3)}`;
}

function previewAddress(address?: string): string | undefined {
  const normalized = cleanText(address);
  if (!normalized) return undefined;
  if (normalized.length <= 24) return normalized;
  return `${normalized.slice(0, 12)}...${normalized.slice(-8)}`;
}

function emptyResult(
  roomId: string,
  ignoredReason: string,
): ExtractMemoryResult {
  return {
    update: {},
    memoryReferences: [],
    traceEvents: [
      {
        roomId,
        node: 'memory_extractor',
        memory_used: [],
        fallback_reason: ignoredReason,
      },
    ],
    ignoredReason,
  };
}

function heuristicExtraction(userMessage: string): MemoryExtraction {
  const normalized = userMessage.toLowerCase();
  const phone =
    userMessage.match(/(?:\+?84|0)(?:[\s.-]?\d){8,10}\b/)?.[0] ?? '';
  const address =
    userMessage.match(
      /(?:địa chỉ|dia chi|address)\s*[:：]?\s*([^.;\n]+)/i,
    )?.[1] ?? '';
  const name =
    userMessage.match(
      /(?:mình tên|tên mình là|ten minh la|name)\s*[:：]?\s*([^,.;\n]+)/i,
    )?.[1] ?? '';
  const preferences = [
    normalized.includes('laptop') ? 'laptop' : '',
    normalized.includes('gaming') ? 'gaming' : '',
    normalized.includes('học ai') || normalized.includes('hoc ai')
      ? 'học AI'
      : '',
  ].filter(Boolean);

  return MemoryExtractionSchema.parse({
    preferences,
    budgetRange:
      userMessage.match(/(?:tầm|tam|khoảng|duoi|dưới)\s*([^,.;\n]+)/i)?.[1] ??
      '',
    brandPreferences: [],
    useCases: preferences.includes('học AI') ? ['học AI'] : [],
    specPreferences: {},
    productsOfInterest: [],
    name,
    phone,
    address,
    explicitFields: [
      ...(preferences.length ? ['preferences'] : []),
      ...(phone ? ['phone'] : []),
      ...(address ? ['address'] : []),
      ...(name ? ['name'] : []),
    ],
    confidence: {
      preferences: preferences.length ? 0.7 : 0,
      phone: phone ? 0.95 : 0,
      address: address ? 0.8 : 0,
      name: name ? 0.8 : 0,
    },
    ignoredReason: '',
  });
}
