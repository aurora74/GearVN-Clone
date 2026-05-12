import { Injectable, Optional } from '@nestjs/common';
import {
  AiRetrievalConfig,
  readAiRetrievalConfig,
} from '../config/ai-retrieval.config';

const OPENROUTER_EMBEDDINGS_URL = 'https://openrouter.ai/api/v1/embeddings';
const DEFAULT_BATCH_SIZE = 32;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 250;
const REQUEST_TIMEOUT_MS = 60_000;

type EmbeddingInputType = 'search_document' | 'search_query';

type EmbedOptions = {
  batchSize?: number;
};

export type EmbeddingResult = {
  vectors: number[][];
  model: string;
  vectorSize: number;
  batchCount: number;
};

type OpenRouterEmbeddingResponse = {
  model?: string;
  data?: Array<{
    embedding?: unknown;
    index?: number;
  }>;
};

@Injectable()
export class OpenRouterBgeM3Client {
  constructor(
    @Optional()
    private readonly config: AiRetrievalConfig = readAiRetrievalConfig(),
  ) {}

  embedDocuments(
    texts: string[],
    options: EmbedOptions = {},
  ): Promise<EmbeddingResult> {
    return this.embedTexts(texts, 'search_document', options);
  }

  embedQuery(text: string): Promise<EmbeddingResult> {
    return this.embedTexts([text], 'search_query');
  }

  async embedTexts(
    texts: string[],
    inputType: EmbeddingInputType,
    options: EmbedOptions = {},
  ): Promise<EmbeddingResult> {
    this.assertOpenRouterConfigured();

    const batchSize = normalizeBatchSize(options.batchSize);
    const vectors: number[][] = [];
    let vectorSize = 0;
    let batchCount = 0;

    for (let start = 0; start < texts.length; start += batchSize) {
      const batch = texts.slice(start, start + batchSize);
      if (batch.length === 0) continue;

      const batchVectors = await this.requestBatch(batch, inputType);
      for (const vector of batchVectors) {
        if (vectorSize === 0) {
          vectorSize = vector.length;
        } else if (vector.length !== vectorSize) {
          throw new Error(
            'OpenRouter embeddings returned inconsistent vector sizes',
          );
        }
        vectors.push(vector);
      }
      batchCount += 1;
    }

    return {
      vectors,
      model: this.config.openRouter.embeddingModel,
      vectorSize,
      batchCount,
    };
  }

  private async requestBatch(
    texts: string[],
    inputType: EmbeddingInputType,
  ): Promise<number[][]> {
    let lastStatus = 0;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetchWithTimeout(OPENROUTER_EMBEDDINGS_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.openRouter.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.config.openRouter.embeddingModel,
            input: texts,
            input_type: inputType,
            encoding_format: 'float',
          }),
        });

        if (response.ok) {
          const payload =
            (await response.json()) as OpenRouterEmbeddingResponse;
          return parseEmbeddingVectors(payload, texts.length);
        }

        lastStatus = response.status;
        if (
          !isTransientStatus(response.status) ||
          attempt === MAX_RETRY_ATTEMPTS
        ) {
          throw new Error(
            `OpenRouter embeddings request failed with HTTP ${response.status}`,
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
      new Error(`OpenRouter embeddings request failed with HTTP ${lastStatus}`)
    );
  }

  private assertOpenRouterConfigured(): void {
    if (!this.config.openRouter.apiKey) {
      throw new Error('Missing AI retrieval env vars: OPENROUTER_API_KEY');
    }
  }
}

function parseEmbeddingVectors(
  payload: OpenRouterEmbeddingResponse,
  expectedCount: number,
): number[][] {
  if (!Array.isArray(payload.data) || payload.data.length !== expectedCount) {
    throw new Error(
      'OpenRouter embeddings response count did not match input batch',
    );
  }

  return payload.data
    .slice()
    .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
    .map((item, index) => {
      if (
        !Array.isArray(item.embedding) ||
        item.embedding.some(
          (value) => typeof value !== 'number' || !Number.isFinite(value),
        )
      ) {
        throw new Error(
          `Malformed OpenRouter embedding vector at batch item ${index}`,
        );
      }
      return item.embedding;
    });
}

function normalizeBatchSize(batchSize?: number): number {
  if (!batchSize || !Number.isInteger(batchSize) || batchSize < 1) {
    return DEFAULT_BATCH_SIZE;
  }
  return batchSize;
}

function isTransientStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function isRetryableFetchError(error: Error): boolean {
  return error.message === 'OpenRouter embeddings request timed out';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('OpenRouter embeddings request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
