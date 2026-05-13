export type RecommendationRankReference = {
  rank: number;
  matchedText: string;
};

export type RecommendationReference =
  | {
      kind: 'rank';
      rank: number;
      phrase: string;
    };

const RANK_WORDS: Record<string, number> = {
  'dau tien': 1,
  dau: 1,
  nhat: 1,
  mot: 1,
  hai: 2,
  ba: 3,
  bon: 4,
  tu: 4,
  nam: 5,
};

const RANK_TOKEN_PATTERN =
  '(?:\\d{1,2}|dau\\s+tien|dau|nhat|mot|hai|ba|bon|tu|nam)';
const REFERENCE_NOUN_PATTERN = '(?:cai|con|mau|san\\s+pham|lua\\s+chon)';
const ORIGINAL_RANK_TOKEN_PATTERN =
  '(?:\\d{1,2}|đầu\\s+tiên|dau\\s+tien|đầu|dau|nhất|nhat|một|mot|hai|ba|bốn|bon|tư|tu|năm|nam)';
const ORIGINAL_REFERENCE_NOUN_PATTERN =
  '(?:cái|cai|con|mẫu|mau|sản\\s+phẩm|san\\s+pham|lựa\\s+chọn|lua\\s+chon)';
const ORIGINAL_ORDINAL_PATTERN = new RegExp(
  [
    `(?:^|\\s)(${ORIGINAL_REFERENCE_NOUN_PATTERN}\\s+(?:thứ\\s+|thu\\s+)?${ORIGINAL_RANK_TOKEN_PATTERN})(?=\\s|$)`,
    `(?:^|\\s)(${ORIGINAL_REFERENCE_NOUN_PATTERN}\\s+(?:số|so)\\s+\\d{1,2})(?=\\s|$)`,
    `(?:^|\\s)((?:thứ|thu)\\s+${ORIGINAL_RANK_TOKEN_PATTERN})(?=\\s|$)`,
    `(?:^|\\s)((?:số|so)\\s+\\d{1,2})(?=\\s|$)`,
    `(?:^|\\s)(đầu\\s+tiên|dau\\s+tien)(?=\\s|$)`,
  ].join('|'),
  'iu',
);
const ORDINAL_PATTERN = new RegExp(
  [
    `\\b${REFERENCE_NOUN_PATTERN}\\s+(?:thu\\s+)?(${RANK_TOKEN_PATTERN})\\b`,
    `\\b${REFERENCE_NOUN_PATTERN}\\s+so\\s+(\\d{1,2})\\b`,
    `\\bthu\\s+(${RANK_TOKEN_PATTERN})\\b`,
    `\\bso\\s+(\\d{1,2})\\b`,
    '\\bdau\\s+tien\\b',
  ].join('|'),
  'i',
);

const ORDINAL_ONLY_PATTERN = new RegExp(
  `^(?:thu\\s+${RANK_TOKEN_PATTERN}|so\\s+\\d{1,2}|dau\\s+tien|${RANK_TOKEN_PATTERN})$`,
  'i',
);

export function parseRecommendationRankReference(
  text: string | number,
): RecommendationRankReference | undefined {
  if (typeof text === 'number') {
    return Number.isInteger(text) && text > 0
      ? { rank: text, matchedText: String(text) }
      : undefined;
  }

  const normalized = normalizeRecommendationReferenceText(text);
  if (!normalized) return undefined;

  const match = normalized.match(ORDINAL_PATTERN);
  if (!match) return undefined;

  const rankToken = match.slice(1).find(Boolean) ?? match[0];
  const rank = rankFromToken(rankToken);
  if (!rank) return undefined;

  return {
    rank,
    matchedText: extractOriginalOrdinalPhrase(text) ?? match[0],
  };
}

export function extractRecommendationReference(
  text: string,
): RecommendationReference | undefined {
  const parsed = parseRecommendationRankReference(text);
  return parsed
    ? { kind: 'rank', rank: parsed.rank, phrase: parsed.matchedText }
    : undefined;
}

export function isOrdinalRecommendationReference(text: string): boolean {
  return Boolean(parseRecommendationRankReference(text));
}

export function isOrdinalOnlyReference(text: string): boolean {
  const normalized = normalizeRecommendationReferenceText(text);
  return Boolean(normalized && ORDINAL_ONLY_PATTERN.test(normalized));
}

function extractOriginalOrdinalPhrase(text: string): string | undefined {
  const match = text.match(ORIGINAL_ORDINAL_PATTERN);
  const phrase = match?.slice(1).find(Boolean)?.trim();
  return phrase || undefined;
}

function rankFromToken(token: string): number | undefined {
  const normalized = normalizeRecommendationReferenceText(token);
  const digitMatch = normalized.match(/\d{1,2}/);
  if (digitMatch) return Number(digitMatch[0]);
  return RANK_WORDS[normalized];
}

function normalizeRecommendationReferenceText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
