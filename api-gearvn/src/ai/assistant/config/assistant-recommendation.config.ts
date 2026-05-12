export const ASSISTANT_RECOMMENDATION_ENV_KEYS = {
  defaultLimit: 'ASSISTANT_RECOMMENDATION_DEFAULT_LIMIT',
  moreOptionsLimit: 'ASSISTANT_RECOMMENDATION_MORE_OPTIONS_LIMIT',
  maxLimit: 'ASSISTANT_RECOMMENDATION_MAX_LIMIT',
} as const;

const DEFAULT_RECOMMENDATION_LIMIT = 3;
const DEFAULT_MORE_OPTIONS_LIMIT = 5;
const DEFAULT_MAX_RECOMMENDATION_LIMIT = 8;
const MIN_RECOMMENDATION_LIMIT = 1;
const HARD_MAX_RECOMMENDATION_LIMIT = 12;

export type AssistantRecommendationConfig = {
  defaultLimit: number;
  moreOptionsLimit: number;
  maxLimit: number;
};

export function readAssistantRecommendationConfig(): AssistantRecommendationConfig {
  const maxLimit = readBoundedIntegerEnv(
    process.env.ASSISTANT_RECOMMENDATION_MAX_LIMIT,
    DEFAULT_MAX_RECOMMENDATION_LIMIT,
    MIN_RECOMMENDATION_LIMIT,
    HARD_MAX_RECOMMENDATION_LIMIT,
  );

  return {
    defaultLimit: readBoundedIntegerEnv(
      process.env.ASSISTANT_RECOMMENDATION_DEFAULT_LIMIT,
      DEFAULT_RECOMMENDATION_LIMIT,
      MIN_RECOMMENDATION_LIMIT,
      HARD_MAX_RECOMMENDATION_LIMIT,
    ),
    moreOptionsLimit: readBoundedIntegerEnv(
      process.env.ASSISTANT_RECOMMENDATION_MORE_OPTIONS_LIMIT,
      DEFAULT_MORE_OPTIONS_LIMIT,
      MIN_RECOMMENDATION_LIMIT,
      HARD_MAX_RECOMMENDATION_LIMIT,
    ),
    maxLimit,
  };
}

function readBoundedIntegerEnv(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const integer = Math.trunc(parsed);
  return Math.min(Math.max(integer, min), max);
}
