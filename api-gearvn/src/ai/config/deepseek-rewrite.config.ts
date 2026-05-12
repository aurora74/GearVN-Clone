export const DEEPSEEK_REWRITE_ENV_KEYS = {
  apiKey: 'DEEPSEEK_API_KEY',
  baseUrl: 'DEEPSEEK_BASE_URL',
  model: 'DEEPSEEK_REWRITE_MODEL',
  timeoutMs: 'DEEPSEEK_REWRITE_TIMEOUT_MS',
} as const;

export type DeepSeekRewriteConfig = {
  deepSeek: {
    apiKey?: string;
    apiKeyPresent: boolean;
    baseUrl: string;
    model: string;
    timeoutMs: number;
  };
};

export function readDeepSeekRewriteConfig(
  options: { requireSecrets?: boolean } = {},
): DeepSeekRewriteConfig {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const config: DeepSeekRewriteConfig = {
    deepSeek: {
      apiKey,
      apiKeyPresent: Boolean(apiKey),
      baseUrl: normalizeBaseUrl(
        process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
      ),
      model: process.env.DEEPSEEK_REWRITE_MODEL || 'deepseek-v4-pro',
      timeoutMs: parseTimeoutMs(process.env.DEEPSEEK_REWRITE_TIMEOUT_MS),
    },
  };

  if (options.requireSecrets) {
    const missing = [['DEEPSEEK_API_KEY', config.deepSeek.apiKey]]
      .filter(([, value]) => !value)
      .map(([name]) => name);

    if (missing.length > 0) {
      throw new Error(`Missing DeepSeek rewrite env vars: ${missing.join(', ')}`);
    }
  }

  return config;
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function parseTimeoutMs(value?: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 90_000;
  return Math.round(parsed);
}
