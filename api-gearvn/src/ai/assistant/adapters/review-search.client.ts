import { Injectable } from '@nestjs/common';
import { ChatOpenRouter } from '@langchain/openrouter';

import { readAssistantModelConfig } from '../config/assistant-model.config';

export type ReviewSearchProductContext = {
  productId?: string;
  name?: string;
  slug?: string;
};

export type ReviewSourceClaim = {
  text: string;
  evidenceStrength: string;
  uncertainty?: string;
};

export type ReviewSearchSource = {
  title: string;
  url: string;
  source?: string;
  publishedAt?: string;
  snippet?: string;
  claims?: ReviewSourceClaim[];
};

type OpenRouterReviewResponse = {
  sources?: ReviewSearchSource[];
};

type ReviewSearchOptions = {
  signal?: AbortSignal;
};

const REVIEW_SEARCH_LANGCHAIN_TIMEOUT_MS = 8_000;
const REVIEW_SEARCH_DIRECT_TIMEOUT_MS = 8_000;

@Injectable()
export class ReviewSearchClient {
  async search(
    query: string,
    products: ReviewSearchProductContext[] = [],
    options: ReviewSearchOptions = {},
  ): Promise<ReviewSearchSource[]> {
    return this.searchReviews(query, products, options);
  }

  async searchReviews(
    query: string,
    products: ReviewSearchProductContext[] = [],
    options: ReviewSearchOptions = {},
  ): Promise<ReviewSearchSource[]> {
    const config = readAssistantModelConfig().openRouter;
    const apiKey = config.apiKey ?? process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return [];
    }

    const runtimeConfig = { ...config, apiKey };
    const prompt = buildReviewSearchPrompt(query, products);
    const langChainResult = await this.tryLangChainWebSearch(
      prompt,
      runtimeConfig,
      options.signal,
    );
    if (langChainResult.length > 0) return langChainResult;
    if (options.signal?.aborted || !runtimeConfig.reviewSearch.directApiFallback) {
      return [];
    }

    try {
      return await this.directOpenRouterSearch(
        prompt,
        runtimeConfig,
        options.signal,
      );
    } catch {
      return [];
    }
  }

  private async tryLangChainWebSearch(
    prompt: string,
    config: ReturnType<typeof readAssistantModelConfig>['openRouter'],
    signal?: AbortSignal,
  ): Promise<ReviewSearchSource[]> {
    try {
      const model = new (ChatOpenRouter as any)({
        apiKey: config.apiKey,
        model: config.chatModel,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        provider: config.provider,
        plugins: [{ id: 'web' }],
      });
      const controller = new AbortController();
      const response = await withTimeout(
        model.invoke(prompt, {
          signal: combineAbortSignals(signal, controller.signal),
        }),
        REVIEW_SEARCH_LANGCHAIN_TIMEOUT_MS,
        () => controller.abort(),
      );
      return parseReviewSources(contentFromModelResponse(response));
    } catch {
      return [];
    }
  }

  private async directOpenRouterSearch(
    prompt: string,
    config: ReturnType<typeof readAssistantModelConfig>['openRouter'],
    signal?: AbortSignal,
  ): Promise<ReviewSearchSource[]> {
    const response = await fetchWithTimeout(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.chatModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: config.temperature,
          max_tokens: Math.min(config.maxTokens, 1200),
          tools: [{ type: config.reviewSearch.preferredTool }],
          provider: config.provider,
        }),
      },
      REVIEW_SEARCH_DIRECT_TIMEOUT_MS,
      signal,
    );

    if (!response.ok) return [];

    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    return parseReviewSources(body.choices?.[0]?.message?.content);
  }
}

function buildReviewSearchPrompt(
  query: string,
  products: ReviewSearchProductContext[],
): string {
  const productText = products
    .map((product) =>
      [product.name, product.slug, product.productId].filter(Boolean).join(' '),
    )
    .filter(Boolean)
    .join('\n');
  const safeQuery = sanitizeReviewQuery(query);

  return [
    'Search public web reviews only for the sanitized customer request below.',
    'Return strict JSON: {"sources":[{"title":"","url":"","source":"","publishedAt":"","snippet":"","claims":[{"text":"","evidenceStrength":"repeated|weak|stale|sponsored|variant-specific|conflicting|unsupported","uncertainty":""}]}]}.',
    'Every claim must map to a source URL. Never include hidden customer, order, phone, or address data.',
    `Review request: ${safeQuery}`,
    productText ? `Products:\n${productText}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
function sanitizeReviewQuery(query: string): string {
  return query
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
function parseReviewSources(content: unknown): ReviewSearchSource[] {
  const text = normalizeContentText(content);
  if (!text) return [];
  try {
    const parsed = JSON.parse(text) as OpenRouterReviewResponse;
    return Array.isArray(parsed.sources) ? parsed.sources : [];
  } catch {
    return [];
  }
}

function contentFromModelResponse(response: unknown): unknown {
  return isRecord(response) && 'content' in response
    ? response.content
    : response;
}

function normalizeContentText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (isRecord(part) && typeof part.text === 'string') return part.text;
      return '';
    })
    .join('')
    .trim();
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: combineAbortSignals(signal, controller.signal),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('OpenRouter review search request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
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
      reject(new Error('OpenRouter review web search timed out'));
    }, timeoutMs);
  });

  return Promise.race([
    promise.finally(() => {
      if (timeout) clearTimeout(timeout);
    }),
    timeoutPromise,
  ]);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
