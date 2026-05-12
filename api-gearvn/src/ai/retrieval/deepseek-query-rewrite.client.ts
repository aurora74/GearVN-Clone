import { Injectable, Optional } from '@nestjs/common';
import {
  DeepSeekRewriteConfig,
  readDeepSeekRewriteConfig,
} from '../config/deepseek-rewrite.config';

const MAX_RETRY_ATTEMPTS = 2;
const RETRY_BASE_DELAY_MS = 250;

export type DeepSeekRewriteMessage = {
  role: 'system' | 'user';
  content: string;
};

export type DeepSeekRewriteInput = {
  messages: DeepSeekRewriteMessage[];
  signal?: AbortSignal;
};

type DeepSeekChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
};

@Injectable()
export class DeepSeekQueryRewriteClient {
  constructor(
    @Optional()
    private readonly config: DeepSeekRewriteConfig = readDeepSeekRewriteConfig(),
  ) {}

  async rewriteJson(input: DeepSeekRewriteInput): Promise<string> {
    this.assertDeepSeekConfigured();

    let lastStatus = 0;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetchWithTimeout(
          `${this.config.deepSeek.baseUrl}/chat/completions`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.config.deepSeek.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: this.config.deepSeek.model,
              response_format: { type: 'json_object' },
              messages: input.messages,
            }),
          },
          this.config.deepSeek.timeoutMs,
          input.signal,
        );

        if (response.ok) {
          return parseRewriteContent(
            (await response.json()) as DeepSeekChatCompletionResponse,
          );
        }

        lastStatus = response.status;
        if (
          !isTransientStatus(response.status) ||
          attempt === MAX_RETRY_ATTEMPTS
        ) {
          throw new Error(
            `DeepSeek rewrite request failed with HTTP ${response.status}`,
          );
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (
          !isRetryableFetchError(lastError) ||
          attempt === MAX_RETRY_ATTEMPTS
        ) {
          throw lastError;
        }
      }

      await delay(RETRY_BASE_DELAY_MS * attempt);
    }

    throw (
      lastError ??
      new Error(`DeepSeek rewrite request failed with HTTP ${lastStatus}`)
    );
  }

  private assertDeepSeekConfigured(): void {
    if (!this.config.deepSeek.apiKey) {
      throw new Error('Missing DeepSeek rewrite env vars: DEEPSEEK_API_KEY');
    }
  }
}

function parseRewriteContent(payload: DeepSeekChatCompletionResponse): string {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('DeepSeek rewrite response did not include JSON content');
  }

  return content;
}

function isTransientStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function isRetryableFetchError(error: Error): boolean {
  return error.message === 'DeepSeek rewrite request timed out';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  upstreamSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromUpstream = () => controller.abort();

  if (upstreamSignal?.aborted) {
    controller.abort();
  } else {
    upstreamSignal?.addEventListener('abort', abortFromUpstream, {
      once: true,
    });
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('DeepSeek rewrite request timed out');
    }
    throw error;
  } finally {
    upstreamSignal?.removeEventListener('abort', abortFromUpstream);
    clearTimeout(timeout);
  }
}
