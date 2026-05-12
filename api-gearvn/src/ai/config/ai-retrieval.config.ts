export const AI_RETRIEVAL_ENV_KEYS = {
  openRouterApiKey: 'OPENROUTER_API_KEY',
  openRouterEmbeddingModel: 'OPENROUTER_EMBEDDING_MODEL',
  openRouterChatModel: 'OPENROUTER_CHAT_MODEL',
  qdrantUrl: 'QDRANT_URL',
  qdrantApiKey: 'QDRANT_API_KEY',
  qdrantCollection: 'QDRANT_COLLECTION',
} as const;

export type AiRetrievalConfig = {
  openRouter: {
    apiKey?: string;
    apiKeyPresent: boolean;
    embeddingModel: string;
    chatModel?: string;
  };
  qdrant: {
    url?: string;
    apiKey?: string;
    apiKeyPresent: boolean;
    collection: string;
  };
};

export function readAiRetrievalConfig(
  options: { requireSecrets?: boolean } = {},
): AiRetrievalConfig {
  const config: AiRetrievalConfig = {
    openRouter: {
      apiKey: process.env.OPENROUTER_API_KEY,
      apiKeyPresent: Boolean(process.env.OPENROUTER_API_KEY),
      embeddingModel: process.env.OPENROUTER_EMBEDDING_MODEL || 'baai/bge-m3',
      chatModel: process.env.OPENROUTER_CHAT_MODEL || undefined,
    },
    qdrant: {
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
      apiKeyPresent: Boolean(process.env.QDRANT_API_KEY),
      collection: process.env.QDRANT_COLLECTION || 'products',
    },
  };

  if (options.requireSecrets) {
    const missing = [
      ['OPENROUTER_API_KEY', config.openRouter.apiKey],
      ['QDRANT_URL', config.qdrant.url],
      ['QDRANT_API_KEY', config.qdrant.apiKey],
    ]
      .filter(([, value]) => !value)
      .map(([name]) => name);

    if (missing.length > 0) {
      throw new Error(`Missing AI retrieval env vars: ${missing.join(', ')}`);
    }
  }

  return config;
}
