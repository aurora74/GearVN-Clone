export const ASSISTANT_MODEL_ENV_KEYS = {
  openRouterApiKey: 'OPENROUTER_API_KEY',
  openRouterChatModel: 'OPENROUTER_CHAT_MODEL',
  openRouterChatMaxTokens: 'OPENROUTER_CHAT_MAX_TOKENS',
} as const;

const DEFAULT_ASSISTANT_CHAT_MODEL = 'deepseek-v4-pro';
const DEFAULT_ASSISTANT_MAX_TOKENS = 2200;
const MIN_ASSISTANT_MAX_TOKENS = 256;
const MAX_ASSISTANT_MAX_TOKENS = 4000;

export type AssistantModelConfig = {
  openRouter: {
    apiKey?: string;
    apiKeyPresent: boolean;
    chatModel: string;
    temperature: 0.1;
    maxTokens: number;
    provider: {
      require_parameters: true;
    };
    reviewSearch: {
      preferredTool: 'openrouter:web_search';
      directApiFallback: true;
    };
  };
};

export type AssistantModelCapabilityReport = {
  supportsStructuredOutputs: boolean;
  supportsReviewSearch: boolean;
};

export function readAssistantModelConfig(): AssistantModelConfig {
  const apiKey = process.env.OPENROUTER_API_KEY;

  const openRouter: AssistantModelConfig['openRouter'] = {
    apiKeyPresent: Boolean(apiKey),
    chatModel: normalizeAssistantChatModel(process.env.OPENROUTER_CHAT_MODEL),
    temperature: 0.1,
    maxTokens: readPositiveIntegerEnv(
      process.env.OPENROUTER_CHAT_MAX_TOKENS,
      DEFAULT_ASSISTANT_MAX_TOKENS,
      MIN_ASSISTANT_MAX_TOKENS,
      MAX_ASSISTANT_MAX_TOKENS,
    ),
    provider: {
      require_parameters: true,
    },
    reviewSearch: {
      preferredTool: 'openrouter:web_search',
      directApiFallback: true,
    },
  };

  Object.defineProperty(openRouter, 'apiKey', {
    value: apiKey,
    enumerable: false,
  });

  return { openRouter };
}

function normalizeAssistantChatModel(value?: string): string {
  const model = value?.trim();
  if (!model) return DEFAULT_ASSISTANT_CHAT_MODEL;
  if (model === 'deepseek-chat' || model === 'deepseek-reasoner') {
    return DEFAULT_ASSISTANT_CHAT_MODEL;
  }
  return model;
}

function readPositiveIntegerEnv(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const integer = Math.trunc(parsed);
  if (integer < min) return fallback;
  return Math.min(integer, max);
}

export function redactedAssistantModelConfig(): Omit<
  AssistantModelConfig['openRouter'],
  'apiKey'
> {
  const { apiKey: _apiKey, ...openRouter } =
    readAssistantModelConfig().openRouter;
  return openRouter;
}

export function assertAssistantModelCapabilities(
  capabilities: AssistantModelCapabilityReport,
): AssistantModelCapabilityReport {
  const missing: string[] = [];

  if (!capabilities.supportsStructuredOutputs) {
    missing.push('strict structured outputs');
  }
  if (!capabilities.supportsReviewSearch) {
    missing.push('review-search support or direct OpenRouter fallback');
  }

  if (missing.length > 0) {
    throw new Error(`Assistant model is missing ${missing.join(', ')}`);
  }

  return capabilities;
}
