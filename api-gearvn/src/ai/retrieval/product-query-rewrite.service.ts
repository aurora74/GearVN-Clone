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
import { ProductRetrievalConstraints } from './product-retrieval.types';
import {
  expandProductQuery,
  extractHardConstraints,
  mergeRetrievalConstraints,
} from './product-reranker';

export type ProductQueryRewriteStatus =
  | 'success'
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
  signal?: AbortSignal;
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
    refreshRateHz: z.number().positive().optional(),
    wireless: z.boolean().optional(),
  })
  .strip();

const hardConstraintsSchema = z
  .object({
    category: z.string().min(1).optional(),
    categoryPath: z.array(z.string().min(1)).optional(),
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
    @Optional()
    private readonly client: Pick<DeepSeekQueryRewriteClient, 'rewriteJson'>,
    @Optional()
    private readonly config: DeepSeekRewriteConfig = readDeepSeekRewriteConfig(),
  ) {}

  async rewrite(
    context: ProductQueryRewriteContext,
  ): Promise<ProductQueryRewriteResult> {
    const startedAt = Date.now();
    let retryCount = 0;

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

    return this.success(parsed.data, {
      retryCount: options.retryCount,
      startedAt: options.startedAt,
    });
  }

  private async requestRewrite(
    context: ProductQueryRewriteContext,
    stricter: boolean,
  ): Promise<string> {
    return this.client.rewriteJson({
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt(stricter),
        },
        {
          role: 'user',
          content: buildUserPrompt(context),
        },
      ],
      signal: context.signal,
    });
  }

  private success(
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
      comboGroups: uniqueStrings(parsed.comboGroups),
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
    const intents = detectIntentPrimitives(context.query);
    const expandedKeywords = uniqueStrings([
      ...expandProductQuery(context.query),
      ...intents.flatMap((intent) => intent.expandedKeywords),
      ...intents.flatMap((intent) => intent.softSignals),
    ]);
    const hardConstraints = mergeRetrievalConstraints(
      extractHardConstraints(context.query),
      constraintsFromIntentPrimitives(context.query),
    );
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
      productGroups: uniqueStrings(intents.flatMap((intent) => intent.productGroups)),
      hardConstraints,
      softSignals: uniqueStrings(intents.flatMap((intent) => intent.softSignals)),
      expandedKeywords,
      comboGroups: comboGroupsFromIntentPrimitives(context.query),
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
    'Allowed hardConstraints keys: category, categoryPath, minPrice, maxPrice, inStockOnly, semanticTags, useCases, targetUsers, requiredSpecs.',
    'Allowed requiredSpecs keys: ramGb, ssdGb, gpu, refreshRateHz, wireless.',
  ].join(' ');
}

function buildUserPrompt(context: ProductQueryRewriteContext): string {
  return JSON.stringify({
    query: context.query,
    previousQuery: context.previousQuery,
    clarificationAnswer: context.clarificationAnswer,
  });
}

function uniqueStrings(values: string[]): string[] {
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
