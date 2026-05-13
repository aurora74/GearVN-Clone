import { Injectable, Optional } from '@nestjs/common';
import { z } from 'zod';
import {
  DeepSeekRewriteConfig,
  readDeepSeekRewriteConfig,
} from '../config/deepseek-rewrite.config';
import { DeepSeekQueryRewriteClient } from './deepseek-query-rewrite.client';
import {
  comboGroupsFromIntentPrimitives,
  constraintsFromIntentPrimitives,
  detectIntentPrimitives,
} from './product-intent-primitives';
import { detectProductFamiliesFromText } from './product-family-taxonomy';
import { ProductRetrievalConstraints } from './product-retrieval.types';
import {
  expandProductQuery,
  extractHardConstraints,
  mergeRetrievalConstraints,
} from './product-reranker';

export type ProductQueryRewriteStatus =
  | 'success'
  | 'skipped_deterministic'
  | 'fallback_api_error'
  | 'fallback_invalid_json'
  | 'fallback_schema_mismatch'
  | 'fallback_low_confidence'
  | 'fallback_timeout';

export type ProductQueryRewriteMetadata = {
  rewrite_provider: 'deepseek';
  rewrite_model: string;
  rewrite_status: ProductQueryRewriteStatus;
  rewrite_retry_count: number;
  rewrite_latency_ms: number;
  rewritten_query: string;
};

export type ProductQueryRewriteContext = {
  query: string;
  previousQuery?: string;
  clarificationAnswer?: string;
  originalQuery?: string;
  hardConstraints?: ProductRetrievalConstraints;
  signal?: AbortSignal;
  timeoutMs?: number;
  allowDeterministicShortCircuit?: boolean;
};

export type ProductQueryRewriteResult = ProductQueryRewriteMetadata & {
  rewrittenQuery: string;
  detectedIntents: string[];
  productGroups: string[];
  hardConstraints: ProductRetrievalConstraints;
  softSignals: string[];
  expandedKeywords: string[];
  comboGroups: string[];
  clarificationNeeded: boolean;
  clarificationReason: string | null;
  confidence?: number;
  metadata: ProductQueryRewriteMetadata;
};

const MIN_REWRITE_CONFIDENCE = 0.55;

const requiredSpecsSchema = z
  .object({
    ramGb: z.number().positive().optional(),
    ssdGb: z.number().positive().optional(),
    gpu: z.string().min(1).optional(),
    displayResolution: z.string().min(1).optional(),
    refreshRateHz: z.number().positive().optional(),
    wireless: z.boolean().optional(),
  })
  .strip();

const hardConstraintsSchema = z
  .object({
    category: z.string().min(1).optional(),
    categoryPath: z.array(z.string().min(1)).optional(),
    categoryHints: z.array(z.string().min(1)).optional(),
    minPrice: z.number().nonnegative().optional(),
    maxPrice: z.number().nonnegative().optional(),
    inStockOnly: z.boolean().optional(),
    semanticTags: z.array(z.string().min(1)).optional(),
    useCases: z.array(z.string().min(1)).optional(),
    targetUsers: z.array(z.string().min(1)).optional(),
    requiredSpecs: requiredSpecsSchema.optional(),
  })
  .strip();

const rewriteSchema = z.object({
  rewrittenQuery: z.string().min(1),
  detectedIntents: z.array(z.string()),
  productGroups: z.array(z.string()),
  hardConstraints: hardConstraintsSchema,
  softSignals: z.array(z.string()),
  expandedKeywords: z.array(z.string()),
  comboGroups: z.array(z.string()),
  clarificationNeeded: z.boolean(),
  clarificationReason: z.string().nullable(),
  confidence: z.number().min(0).max(1).optional(),
});

type ParsedRewrite = z.infer<typeof rewriteSchema>;

@Injectable()
export class ProductQueryRewriteService {
  constructor(
    private readonly client: DeepSeekQueryRewriteClient,
    @Optional()
    private readonly config: DeepSeekRewriteConfig = readDeepSeekRewriteConfig(),
  ) {}

  async rewrite(
    context: ProductQueryRewriteContext,
  ): Promise<ProductQueryRewriteResult> {
    const startedAt = Date.now();
    let retryCount = 0;

    if (shouldUseDeterministicShortCircuit(context)) {
      return this.fallback(context, {
        status: 'skipped_deterministic',
        retryCount,
        startedAt,
      });
    }

    try {
      const first = await this.requestRewrite(context, false);
      const firstParsed = parseProviderJson(first);
      if (firstParsed.kind === 'invalid_json') {
        retryCount = 1;
        const second = await this.requestRewrite(context, true);
        const secondParsed = parseProviderJson(second);
        if (secondParsed.kind === 'invalid_json') {
          return this.fallback(context, {
            status: 'fallback_invalid_json',
            retryCount,
            startedAt,
          });
        }
        return this.fromParsedOrFallback(context, secondParsed.value, {
          retryCount,
          startedAt,
          schemaFallbackStatus: 'fallback_schema_mismatch',
        });
      }

      return this.fromParsedOrFallback(context, firstParsed.value, {
        retryCount,
        startedAt,
        schemaFallbackStatus: 'fallback_schema_mismatch',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isRewriteAbortError(error, context.signal)) {
        throw error;
      }
      return this.fallback(context, {
        status: message.includes('timed out')
          ? 'fallback_timeout'
          : 'fallback_api_error',
        retryCount,
        startedAt,
      });
    }
  }

  private async fromParsedOrFallback(
    context: ProductQueryRewriteContext,
    raw: unknown,
    options: {
      retryCount: number;
      startedAt: number;
      schemaFallbackStatus: ProductQueryRewriteStatus;
    },
  ): Promise<ProductQueryRewriteResult> {
    const parsed = rewriteSchema.safeParse(raw);
    if (!parsed.success) {
      if (options.retryCount === 0) {
        const second = await this.requestRewrite(context, true);
        const secondJson = parseProviderJson(second);
        if (secondJson.kind === 'invalid_json') {
          return this.fallback(context, {
            status: 'fallback_invalid_json',
            retryCount: 1,
            startedAt: options.startedAt,
          });
        }

        return this.fromParsedOrFallback(context, secondJson.value, {
          ...options,
          retryCount: 1,
        });
      }

      return this.fallback(context, {
        status: options.schemaFallbackStatus,
        retryCount: options.retryCount,
        startedAt: options.startedAt,
      });
    }

    if ((parsed.data.confidence ?? 1) < MIN_REWRITE_CONFIDENCE) {
      return this.fallback(context, {
        status: 'fallback_low_confidence',
        retryCount: options.retryCount,
        startedAt: options.startedAt,
      });
    }

    return this.success(context, parsed.data, {
      retryCount: options.retryCount,
      startedAt: options.startedAt,
    });
  }

  private async requestRewrite(
    context: ProductQueryRewriteContext,
    stricter: boolean,
  ): Promise<string> {
    const messages = [
      {
        role: 'system' as const,
        content: buildSystemPrompt(stricter),
      },
      {
        role: 'user' as const,
        content: buildUserPrompt(context),
      },
    ];

    if (!context.timeoutMs) {
      return this.client.rewriteJson({
        messages,
        signal: context.signal,
      });
    }

    const controller = new AbortController();
    const abortFromUpstream = () => controller.abort();
    if (context.signal?.aborted) {
      controller.abort();
    } else {
      context.signal?.addEventListener('abort', abortFromUpstream, {
        once: true,
      });
    }

    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new Error('DeepSeek rewrite request timed out'));
      }, context.timeoutMs);
    });

    try {
      return await Promise.race([
        this.client.rewriteJson({
          messages,
          signal: controller.signal,
          timeoutMs: context.timeoutMs,
        }),
        timeoutPromise,
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
      context.signal?.removeEventListener('abort', abortFromUpstream);
    }
  }

  private success(
    context: ProductQueryRewriteContext,
    parsed: ParsedRewrite,
    options: { retryCount: number; startedAt: number },
  ): ProductQueryRewriteResult {
    const metadata = this.metadata({
      status: 'success',
      retryCount: options.retryCount,
      startedAt: options.startedAt,
      rewrittenQuery: parsed.rewrittenQuery,
    });

    return {
      ...metadata,
      rewrittenQuery: parsed.rewrittenQuery,
      detectedIntents: uniqueStrings(parsed.detectedIntents),
      productGroups: uniqueStrings(parsed.productGroups),
      hardConstraints: normalizeHardConstraints(parsed.hardConstraints),
      softSignals: uniqueStrings(parsed.softSignals),
      expandedKeywords: uniqueStrings(parsed.expandedKeywords),
      comboGroups: comboGroupsForContext(context, parsed.comboGroups),
      clarificationNeeded: parsed.clarificationNeeded,
      clarificationReason: parsed.clarificationReason,
      confidence: parsed.confidence,
      metadata,
    };
  }

  private fallback(
    context: ProductQueryRewriteContext,
    options: {
      status: ProductQueryRewriteStatus;
      retryCount: number;
      startedAt: number;
    },
  ): ProductQueryRewriteResult {
    const fallbackTexts = uniqueStrings(
      [
        context.originalQuery,
        context.clarificationAnswer,
        context.query,
      ].filter(
        (text): text is string =>
          typeof text === 'string' && text.trim().length > 0,
      ),
    );
    const intents = detectIntentPrimitives(fallbackTexts.join(' '));
    const expandedKeywords = uniqueStrings([
      ...fallbackTexts.flatMap((text) => expandProductQuery(text)),
      ...intents.flatMap((intent) => intent.expandedKeywords),
      ...intents.flatMap((intent) => intent.softSignals),
    ]);
    const hardConstraints = fallbackTexts.reduce<ProductRetrievalConstraints>(
      (constraints, text) =>
        mergeRetrievalConstraints(
          mergeRetrievalConstraints(constraints, extractHardConstraints(text)),
          constraintsFromIntentPrimitives(text),
        ),
      context.hardConstraints ?? {},
    );
    const explicitFamilyHints = explicitProductFamiliesForContext(
      context,
      fallbackTexts.join(' '),
    );
    if (
      options.status === 'skipped_deterministic' &&
      explicitFamilyHints.length === 1
    ) {
      hardConstraints.categoryHints = explicitFamilyHints;
    }
    const metadata = this.metadata({
      status: options.status,
      retryCount: options.retryCount,
      startedAt: options.startedAt,
      rewrittenQuery: context.query,
    });

    return {
      ...metadata,
      rewrittenQuery: context.query,
      detectedIntents: intents.map((intent) => intent.id),
      productGroups: uniqueStrings(
        intents.flatMap((intent) => intent.productGroups),
      ),
      hardConstraints,
      softSignals: uniqueStrings(
        intents.flatMap((intent) => intent.softSignals),
      ),
      expandedKeywords,
      comboGroups: comboGroupsForContext(
        context,
        comboGroupsFromIntentPrimitives(fallbackTexts.join(' ')),
      ),
      clarificationNeeded: false,
      clarificationReason: null,
      metadata,
    };
  }

  private metadata(input: {
    status: ProductQueryRewriteStatus;
    retryCount: number;
    startedAt: number;
    rewrittenQuery: string;
  }): ProductQueryRewriteMetadata {
    return {
      rewrite_provider: 'deepseek',
      rewrite_model: this.config.deepSeek.model,
      rewrite_status: input.status,
      rewrite_retry_count: input.retryCount,
      rewrite_latency_ms: Math.max(0, Date.now() - input.startedAt),
      rewritten_query: input.rewrittenQuery,
    };
  }
}

function isRewriteAbortError(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (!(error instanceof Error)) return false;

  return error.name === 'AbortError' || /request aborted/i.test(error.message);
}

function parseProviderJson(
  raw: string,
): { kind: 'ok'; value: unknown } | { kind: 'invalid_json' } {
  try {
    return { kind: 'ok', value: JSON.parse(raw) };
  } catch {
    return { kind: 'invalid_json' };
  }
}

function normalizeHardConstraints(
  constraints: ParsedRewrite['hardConstraints'],
): ProductRetrievalConstraints {
  const normalized: ProductRetrievalConstraints = {};

  if (constraints.category) normalized.category = constraints.category;
  if (constraints.categoryPath?.length) {
    normalized.categoryPath = uniqueStrings(constraints.categoryPath);
  }
  if (constraints.categoryHints?.length) {
    normalized.categoryHints = uniqueStrings(constraints.categoryHints);
  }
  if (typeof constraints.minPrice === 'number') {
    normalized.minPrice = constraints.minPrice;
  }
  if (typeof constraints.maxPrice === 'number') {
    normalized.maxPrice = constraints.maxPrice;
  }
  if (typeof constraints.inStockOnly === 'boolean') {
    normalized.inStockOnly = constraints.inStockOnly;
  }
  if (constraints.semanticTags?.length) {
    normalized.semanticTags = uniqueStrings(constraints.semanticTags);
  }
  if (constraints.useCases?.length) {
    normalized.useCases = uniqueStrings(constraints.useCases);
  }
  if (constraints.targetUsers?.length) {
    normalized.targetUsers = uniqueStrings(constraints.targetUsers);
  }
  if (
    constraints.requiredSpecs &&
    Object.keys(constraints.requiredSpecs).length > 0
  ) {
    normalized.requiredSpecs = constraints.requiredSpecs;
  }

  return normalized;
}

function buildSystemPrompt(stricter: boolean): string {
  const strictLine = stricter
    ? 'Return only valid JSON matching the schema. Do not include markdown, comments, or extra fields.'
    : 'Return a single JSON object matching the schema.';

  return [
    'Rewrite Vietnamese technology-store shopping needs into structured retrieval input.',
    strictLine,
    'Required fields: rewrittenQuery, detectedIntents, productGroups, hardConstraints, softSignals, expandedKeywords, comboGroups, clarificationNeeded, clarificationReason, confidence.',
    'Allowed hardConstraints keys: category, categoryPath, categoryHints, minPrice, maxPrice, inStockOnly, semanticTags, useCases, targetUsers, requiredSpecs.',
    'Allowed requiredSpecs keys: ramGb, ssdGb, gpu, displayResolution, refreshRateHz, wireless.',
    'Only populate comboGroups when the user text explicitly asks for a setup, combo, full set, build, rig, or multiple product categories; use cases alone such as AI, gaming, study, or work are not combo requests.',
    'If deterministicHardConstraints are present in the user payload, preserve that product family in hardConstraints and never replace it with another category.',
  ].join(' ');
}

function buildUserPrompt(context: ProductQueryRewriteContext): string {
  return JSON.stringify({
    query: context.query,
    previousQuery: context.previousQuery,
    clarificationAnswer: context.clarificationAnswer,
    originalQuery: context.originalQuery,
    deterministicHardConstraints: context.hardConstraints,
  });
}

function shouldUseDeterministicShortCircuit(
  context: ProductQueryRewriteContext,
): boolean {
  if (context.allowDeterministicShortCircuit !== true) return false;
  if (isExplicitComboRequest(context)) return false;

  const texts = [
    context.originalQuery,
    context.clarificationAnswer,
    context.previousQuery,
    context.query,
  ].filter(
    (value): value is string =>
      typeof value === 'string' && value.trim().length > 0,
  );
  const combinedText = texts.join(' ');
  const normalized = normalizeRewriteIntentText(combinedText);
  if (!normalized) return false;

  const familyEligibilityText = productFamilyEligibilityText(
    context,
    combinedText,
  );
  const normalizedFamilyEligibility = normalizeRewriteIntentText(
    familyEligibilityText,
  );
  if (
    /\b(hoac|hay|vs|voi|kem|cung voi)\b/.test(normalizedFamilyEligibility) &&
    countProductGroupMentions(normalizedFamilyEligibility) >= 2
  ) {
    return false;
  }

  const intents = detectIntentPrimitives(combinedText);
  const explicitFamilyHints = explicitProductFamiliesForContext(
    context,
    combinedText,
  );
  if (explicitFamilyHints.length !== 1) return false;

  const hardConstraints = texts.reduce<ProductRetrievalConstraints>(
    (constraints, text) =>
      mergeRetrievalConstraints(
        mergeRetrievalConstraints(constraints, extractHardConstraints(text)),
        constraintsFromIntentPrimitives(text),
      ),
    context.hardConstraints ?? {},
  );
  const usefulSpecSignals =
    Object.keys(hardConstraints.requiredSpecs ?? {}).length > 0;
  const usefulNeedSignals = Boolean(
    hardConstraints.semanticTags?.length ||
      hardConstraints.useCases?.length ||
      hardConstraints.targetUsers?.length ||
      intents.some((intent) => intent.softSignals.length > 0),
  );
  const usefulBudgetSignals =
    typeof hardConstraints.minPrice === 'number' ||
    typeof hardConstraints.maxPrice === 'number';

  return usefulBudgetSignals || usefulSpecSignals || usefulNeedSignals;
}
function comboGroupsForContext(
  context: ProductQueryRewriteContext,
  groups: string[],
): string[] {
  return isExplicitComboRequest(context) ? uniqueStrings(groups) : [];
}

function isExplicitComboRequest(context: ProductQueryRewriteContext): boolean {
  const text = productFamilyEligibilityText(context);
  const normalized = normalizeRewriteIntentText(text);
  if (!normalized) return false;

  if (
    /\b(setup|set up|combo|full set|build pc|build may|lap rap|rap may|rig|goc|dan|dan may|dan pc|bo|bo lam|bo may|bo pc|bo gear|bo gaming|dong bo|tron bo|ca bo|mot bo)\b/.test(
      normalized,
    )
  ) {
    return true;
  }

  return countProductGroupMentions(normalized) >= 2;
}

function countProductGroupMentions(normalized: string): number {
  const patterns = [
    /\blaptop\b|notebook|may tinh xach tay/,
    /\bpc\b|desktop|may tinh ban/,
    /man hinh|monitor/,
    /ban phim|keyboard/,
    /chuot|mouse/,
    /tai nghe|headset|headphone/,
    /webcam|camera/,
    /microphone|\bmicro\b/,
    /\bssd\b|o cung|storage/,
    /\bram\b/,
  ];
  return patterns.filter((pattern) => pattern.test(normalized)).length;
}

function normalizeRewriteIntentText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function explicitProductFamiliesForContext(
  context: ProductQueryRewriteContext,
  text: string,
): string[] {
  return uniqueStrings([
    ...(context.hardConstraints?.categoryHints ?? []),
    context.hardConstraints?.category,
    ...detectProductFamiliesFromText(productFamilyEligibilityText(context, text)),
  ]);
}

function productFamilyEligibilityText(
  context: ProductQueryRewriteContext,
  fallbackText = context.query,
): string {
  const userAuthoredTexts = [
    context.originalQuery,
    context.clarificationAnswer,
    context.previousQuery,
  ].filter(
    (value): value is string =>
      typeof value === 'string' && value.trim().length > 0,
  );

  return userAuthoredTexts.length > 0
    ? userAuthoredTexts.join(' ')
    : fallbackText;
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const text = String(value ?? '').trim();
    const key = text.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }

  return result;
}
