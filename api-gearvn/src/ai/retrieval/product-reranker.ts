import {
  HybridRetrievalScore,
  ProductCandidate,
  ProductRetrievalConstraints,
  ProductRerankReason,
  RerankedProductCandidate,
} from './product-retrieval.types';
import {
  expandWithTechDictionary,
  normalizeDictionaryText,
} from './product-domain-dictionary';
import {
  constraintsFromIntentPrimitives,
  expandWithIntentPrimitives,
} from './product-intent-primitives';
import {
  detectProductFamiliesFromText,
  normalizedTextHasProductFamilyAlias,
  productFamilyAliases,
  productFamilyCategoryAliases,
} from './product-family-taxonomy';
type ExpansionRule = {
  patterns: string[];
  expansions: string[];
};

type RerankOptions = {
  topK?: number;
  constraints?: ProductRetrievalConstraints;
  enforceRequiredSpecs?: boolean;
};

const EXPANSION_RULES: ExpansionRule[] = [
  {
    patterns: ['iphone'],
    expansions: ['iphone', 'apple', 'dien thoai', 'smartphone'],
  },
  {
    patterns: ['macbook'],
    expansions: ['macbook', 'apple', 'laptop', 'van phong', 'creator'],
  },
  {
    patterns: ['rtx laptop'],
    expansions: [
      'rtx laptop',
      'gpu nvidia',
      'gaming',
      'do hoa',
      'lap trinh ai',
    ],
  },
  {
    patterns: ['man hinh dell'],
    expansions: ['man hinh dell', 'monitor', 'dell', 'eye comfort'],
  },
  {
    patterns: ['laptop hoc ai', 'hoc ai'],
    expansions: [
      'laptop',
      'lap trinh ai',
      'gpu nvidia',
      'ram 16gb',
      'sinh vien it',
    ],
  },
  {
    patterns: ['may lam do hoa', 'lam do hoa'],
    expansions: [
      'creator',
      'do hoa',
      'gpu nvidia',
      'render',
      'man hinh mau chuan',
    ],
  },
  {
    patterns: ['setup lam viec tai nha', 'bo lam viec tai nha'],
    expansions: [
      'work from home',
      'van phong',
      'man hinh',
      'ban phim wireless',
      'webcam',
    ],
  },
  {
    patterns: ['man hinh do moi mat', 'do moi mat'],
    expansions: ['monitor', 'eye comfort', 'bao ve mat', 'ips', 'flicker free'],
  },
  {
    patterns: ['qua cho ban trai thich game', 'ban trai thich game'],
    expansions: [
      'gaming',
      'qua tang',
      'ban trai',
      'chuot gaming',
      'ban phim co',
    ],
  },
  {
    patterns: ['sinh vien it', 'qua cho sinh vien it'],
    expansions: [
      'sinh vien it',
      'lap trinh',
      'laptop',
      'ram 16gb',
      'ssd 512gb',
    ],
  },
  {
    patterns: ['ram 16gb'],
    expansions: ['ram 16gb', 'memory 16gb', 'da nhiem'],
  },
  {
    patterns: ['ssd 512gb'],
    expansions: ['ssd 512gb', 'luu tru 512gb', 'nvme'],
  },
  {
    patterns: ['gpu nvidia', 'nvidia'],
    expansions: ['gpu nvidia', 'rtx', 'cuda', 'do hoa', 'ai'],
  },
  {
    patterns: ['144hz'],
    expansions: ['144hz', 'tan so quet cao', 'gaming monitor'],
  },
  {
    patterns: ['ban phim co wireless', 'keyboard wireless'],
    expansions: [
      'ban phim co wireless',
      'wireless mechanical keyboard',
      'bluetooth',
    ],
  },
  {
    patterns: ['goc livestream', 'livestream'],
    expansions: ['goc livestream', 'webcam', 'micro', 'den led', 'creator'],
  },
  {
    patterns: ['hoc online'],
    expansions: ['hoc online', 'webcam', 'micro', 'laptop sinh vien'],
  },
  {
    patterns: ['may manh gia tot', 'gia tot'],
    expansions: ['hieu nang', 'gia tot', 'best value', 'khuyen mai'],
  },
];

export function expandProductQuery(query: string): string[] {
  const normalized = normalizeText(query);
  const expansions = new Set<string>([
    ...splitQueryTerms(normalized),
    ...expandWithTechDictionary(query),
    ...expandWithIntentPrimitives(query),
  ]);

  for (const rule of EXPANSION_RULES) {
    if (rule.patterns.some((pattern) => normalized.includes(pattern))) {
      rule.expansions.forEach((term) => expansions.add(term));
    }
  }

  return Array.from(expansions).filter(Boolean);
}

export function extractHardConstraints(
  query: string,
): ProductRetrievalConstraints {
  const normalized = normalizeText(query);
  const constraints: ProductRetrievalConstraints = {};
  const requiredSpecs: NonNullable<
    ProductRetrievalConstraints['requiredSpecs']
  > = {};

  const maxPrice = extractMaxPrice(normalized);
  if (maxPrice) constraints.maxPrice = maxPrice;
  if (/\b(con hang|san hang|co san|stock)\b/.test(normalized)) {
    constraints.inStockOnly = true;
  }

  const categoryHints = extractCategoryHints(normalized);
  if (categoryHints.length > 0) constraints.categoryHints = categoryHints;

  const ramMatch = normalized.match(/ram\s*(\d{1,3})\s*gb/);
  if (ramMatch) requiredSpecs.ramGb = Number(ramMatch[1]);

  const ssdMatch = normalized.match(/ssd\s*(\d{3,4})\s*gb/);
  if (ssdMatch) requiredSpecs.ssdGb = Number(ssdMatch[1]);

  const gpuModel = extractConcreteGpuModel(normalized);
  if (gpuModel) {
    requiredSpecs.gpu = gpuModel;
  } else if (
    normalized.includes('gpu nvidia') ||
    normalized.includes('nvidia')
  ) {
    requiredSpecs.gpu = 'nvidia';
  }

  const displayResolution = extractDisplayResolution(normalized);
  if (displayResolution) requiredSpecs.displayResolution = displayResolution;

  const hzMatch = normalized.match(/(\d{2,3})\s*hz/);
  if (hzMatch) requiredSpecs.refreshRateHz = Number(hzMatch[1]);

  if (normalized.includes('wireless') || normalized.includes('khong day')) {
    requiredSpecs.wireless = true;
  }

  if (Object.keys(requiredSpecs).length > 0) {
    constraints.requiredSpecs = requiredSpecs;
  }

  const merged = mergeRetrievalConstraints(
    constraintsFromIntentPrimitives(query),
    constraints,
  );

  return categoryHints.length > 0 ? { ...merged, categoryHints } : merged;
}

export function rerankProducts(
  query: string,
  candidates: ProductCandidate[],
  options: RerankOptions = {},
): RerankedProductCandidate[] {
  const constraints = mergeRetrievalConstraints(
    extractHardConstraints(query),
    options.constraints,
  );
  const expanded = expandProductQuery(query);
  const queryTerms = new Set(expanded.map(normalizeText));

  return candidates
    .map((candidate) =>
      scoreCandidate(candidate, query, queryTerms, constraints, {
        enforceRequiredSpecs: options.enforceRequiredSpecs === true,
      }),
    )
    .filter((candidate): candidate is RerankedProductCandidate =>
      Boolean(candidate),
    )
    .sort((left, right) => {
      if (right.rerankScore !== left.rerankScore) {
        return right.rerankScore - left.rerankScore;
      }
      return right.score - left.score;
    })
    .slice(0, options.topK ?? candidates.length);
}

export function productCandidateSatisfiesHardConstraints(
  candidate: ProductCandidate,
  constraints: ProductRetrievalConstraints,
  options?: { enforceRequiredSpecs?: boolean },
): boolean {
  if (constraints.inStockOnly && candidate.payload.stock <= 0) return false;
  if (
    typeof constraints.minPrice === 'number' &&
    effectivePrice(candidate) < constraints.minPrice
  ) {
    return false;
  }
  if (
    typeof constraints.maxPrice === 'number' &&
    effectivePrice(candidate) > constraints.maxPrice
  ) {
    return false;
  }
  if (
    hasHardCategoryConstraint(constraints) &&
    !matchesCategory(candidate, constraints)
  ) {
    return false;
  }
  if (
    options?.enforceRequiredSpecs === true &&
    !candidateSatisfiesRequiredSpecs(candidate, constraints.requiredSpecs)
  ) {
    return false;
  }
  return true;
}

function scoreCandidate(
  candidate: ProductCandidate,
  query: string,
  queryTerms: Set<string>,
  constraints: ProductRetrievalConstraints,
  options: { enforceRequiredSpecs: boolean },
): RerankedProductCandidate | null {
  if (!productCandidateSatisfiesHardConstraints(candidate, constraints)) {
    return null;
  }
  if (
    options.enforceRequiredSpecs &&
    !candidateSatisfiesRequiredSpecs(candidate, constraints.requiredSpecs)
  ) {
    return null;
  }
  const reasons: ProductRerankReason[] = [
    {
      code: 'vector_score',
      message: 'Qdrant vector similarity baseline',
      weight: normalizeVectorScore(candidate.score),
    },
  ];
  const haystack = candidateText(candidate);
  const normalizedQuery = normalizeText(query);
  const bm25Score = normalizeBm25Score(candidate.lexicalScore ?? 0);
  const cosineScore = normalizeVectorScore(candidate.score);
  let constraintScore = 0;
  let specScore = 0;
  const availabilityScore = candidate.payload.stock > 0 ? 1 : 0;

  if ((candidate.lexicalScore ?? 0) > 0) {
    reasons.push({
      code: 'bm25_score',
      message: `Mongo lexical/spec score matched ${(
        candidate.matchedTerms ?? []
      )
        .slice(0, 5)
        .join(', ')}`,
      weight: bm25Score,
    });
  }

  if (
    haystack.includes(normalizedQuery) ||
    normalizedQuery.includes(normalizeText(candidate.payload.name))
  ) {
    reasons.push({
      code: 'exact_match',
      message: 'Product name/text matches query',
      weight: 6,
    });
  }

  const keywordMatches = Array.from(queryTerms).filter(
    (term) => term && haystack.includes(term),
  );
  if (keywordMatches.length > 0) {
    reasons.push({
      code: 'keyword_match',
      message: `Matched keywords: ${keywordMatches.slice(0, 5).join(', ')}`,
      weight: Math.min(5, keywordMatches.length),
    });
  }

  if (matchesCategory(candidate, constraints)) {
    constraintScore += 1;
    reasons.push({
      code: 'category_match',
      message: 'Category matches query intent',
      weight: 4,
    });
  }

  const specMatches = countSpecMatches(candidate, constraints.requiredSpecs);
  if (specMatches > 0) {
    specScore += Math.min(1, specMatches / 3);
    reasons.push({
      code: 'spec_match',
      message: `${specMatches} required technical specs matched`,
      weight: specMatches * 3,
    });
  }

  if (
    typeof constraints.maxPrice === 'number' ||
    typeof constraints.minPrice === 'number' ||
    normalizedQuery.includes('gia tot')
  ) {
    constraintScore += 1;
    reasons.push({
      code: 'price_compatible',
      message: 'Price fits query budget signal',
      weight: 2,
    });
  }

  if (candidate.payload.stock > 0) {
    reasons.push({
      code: 'in_stock',
      message: 'Product is in stock',
      weight: 1.5,
    });
  }

  if (matchesAny(candidate.payload.useCases, queryTerms)) {
    reasons.push({
      code: 'need_match',
      message: 'Use case matches customer need',
      weight: 3,
    });
  }

  if (matchesAny(candidate.payload.targetUsers, queryTerms)) {
    reasons.push({
      code: 'target_user_match',
      message: 'Target user matches query',
      weight: 2.5,
    });
  }

  const hybrid: HybridRetrievalScore = {
    bm25Score,
    cosineScore,
    constraintScore: roundScore(Math.min(1, constraintScore / 2)),
    specScore: roundScore(specScore),
    availabilityScore,
    rerankScore: 0,
  };
  hybrid.rerankScore = roundScore(
    hybrid.bm25Score * 3 +
      hybrid.cosineScore * 2 +
      hybrid.constraintScore * 2 +
      hybrid.specScore * 2 +
      hybrid.availabilityScore,
  );

  const reasonScore = reasons.reduce((sum, reason) => sum + reason.weight, 0);

  return {
    ...candidate,
    rerankScore: roundScore(reasonScore + hybrid.rerankScore),
    hybrid,
    reasons,
  };
}

function extractMaxPrice(normalizedQuery: string): number | undefined {
  const rangeMatch = normalizedQuery.match(
    /(?:ngan sach|tam gia|budget|khoang|tam)?\s*(\d{1,3}(?:[.,]\d+)?)\s*(?:-|den|toi)\s*(\d{1,3}(?:[.,]\d+)?)\s*(trieu|tr|m|k|nghin)\b/,
  );
  if (rangeMatch) {
    return priceAmount(rangeMatch[2], rangeMatch[3]);
  }

  const majorUnitMatch = normalizedQuery.match(
    /(?:duoi|toi da|khoang duoi|ngan sach|tam gia|budget|khoang|tam)?\s*(\d{1,3}(?:[.,]\d+)?)\s*(trieu|tr|m)\b/,
  );
  if (majorUnitMatch) {
    return priceAmount(majorUnitMatch[1], majorUnitMatch[2]);
  }

  const smallUnitMatch = normalizedQuery.match(
    /(?:duoi|toi da|khoang duoi|ngan sach|tam gia|budget|khoang|tam)\s*(\d{1,3}(?:[.,]\d+)?)\s*(k|nghin)\b/,
  );
  if (
    smallUnitMatch &&
    !isDisplayResolutionToken(normalizedQuery, smallUnitMatch[0])
  ) {
    return priceAmount(smallUnitMatch[1], smallUnitMatch[2]);
  }

  const vndMatch = normalizedQuery.match(/\b(\d{1,3})\s*000\s*000\b/);
  if (vndMatch) return Number(vndMatch[1]) * 1_000_000;

  const compactVndMatch = normalizedQuery.match(/\b(\d{7,9})\b/);
  if (compactVndMatch) return Number(compactVndMatch[1]);

  return undefined;
}

function isDisplayResolutionToken(
  normalizedQuery: string,
  matchedToken: string,
): boolean {
  const normalizedToken = normalizeText(matchedToken);
  if (!/\b(?:2|4|8)\s*k\b/.test(normalizedToken)) return false;
  return /\b(man hinh|monitor|do phan giai|resolution|qhd|uhd)\b/.test(
    normalizedQuery,
  );
}
function priceAmount(rawAmount: string, unit?: string): number | undefined {
  const amount = Number(rawAmount.replace(',', '.'));
  if (!Number.isFinite(amount)) return undefined;
  if (unit === 'k' || unit === 'nghin') return Math.round(amount * 1_000);
  return Math.round(amount * 1_000_000);
}

function extractCategoryHints(normalizedQuery: string): string[] {
  return detectProductFamiliesFromText(normalizedQuery);
}

function matchesCategory(
  candidate: ProductCandidate,
  constraints: ProductRetrievalConstraints,
): boolean {
  const categoryText = normalizeText(
    [candidate.payload.category, ...candidate.payload.categoryPath].join(' '),
  );
  const exactHints = [
    constraints.category,
    ...(constraints.categoryPath ?? []),
  ].filter((hint): hint is string => Boolean(hint));
  const hints =
    exactHints.length > 0 ? exactHints : (constraints.categoryHints ?? []);

  return hints.some((hint) =>
    categoryTextMatchesHint(candidate, categoryText, hint),
  );
}

function hasHardCategoryConstraint(
  constraints: ProductRetrievalConstraints,
): boolean {
  return Boolean(
    constraints.category ||
      constraints.categoryPath?.length ||
      constraints.categoryHints?.length,
  );
}

function categoryTextMatchesHint(
  candidate: ProductCandidate,
  categoryText: string,
  hint: string,
): boolean {
  const normalizedHint = normalizeText(hint);
  if (normalizedHint === 'laptop') {
    return candidateLooksLikePortableLaptop(candidate, categoryText);
  }
  if (normalizedHint === 'pc') {
    return candidateLooksLikeDesktopPc(candidate, categoryText);
  }
  const aliases = productFamilyCategoryAliases(normalizedHint);
  return aliases.some((alias) => normalizedTextHasAlias(categoryText, alias));
}

function candidateLooksLikePortableLaptop(
  candidate: ProductCandidate,
  categoryText: string,
): boolean {
  const aliases = productFamilyCategoryAliases('laptop');
  if (!aliases.some((alias) => normalizedTextHasAlias(categoryText, alias))) {
    return false;
  }

  const name = normalizeText(candidate.payload.name);
  if (aliases.some((alias) => normalizedTextHasAlias(name, alias))) return true;

  const specText = normalizeText(
    JSON.stringify(candidate.payload.normalizedSpecs ?? {}),
  );
  return /\b(screen\s*size|screensize|kich thuoc man hinh)\b/.test(specText);
}

function candidateLooksLikeDesktopPc(
  candidate: ProductCandidate,
  categoryText: string,
): boolean {
  const portableAliases = productFamilyCategoryAliases('laptop');
  const name = normalizeText(candidate.payload.name);
  const categoryAndNameText = normalizeText(
    [
      categoryText,
      name,
      ...(candidate.payload.semanticTags ?? []),
      ...(candidate.payload.useCases ?? []),
      ...(candidate.payload.targetUsers ?? []),
    ].join(' '),
  );

  if (
    portableAliases.some((alias) =>
      normalizedTextHasAlias(categoryAndNameText, alias),
    )
  ) {
    return false;
  }

  if (
    productFamilyAliases('pc').some((alias) =>
      normalizedTextHasAlias(categoryAndNameText, alias),
    )
  ) {
    return true;
  }

  return productFamilyCategoryAliases('pc').some((alias) =>
    normalizedTextHasAlias(categoryText, alias),
  );
}

function extractConcreteGpuModel(normalizedQuery: string): string | undefined {
  const match = normalizedQuery.match(
    /\b(?:nvidia\s*)?(rtx|gtx)\s*-?(\d{3,4})(?:\s*(ti|super))?\b/,
  );
  if (!match) return undefined;
  return [match[1], match[2], match[3]].filter(Boolean).join(' ');
}

function extractDisplayResolution(normalizedQuery: string): string | undefined {
  if (/\b(?:2\s*k|qhd|wqhd|2560\s*x\s*1440|1440p)\b/.test(normalizedQuery)) {
    return '2k';
  }
  if (/\b(?:4\s*k|uhd|3840\s*x\s*2160|2160p)\b/.test(normalizedQuery)) {
    return '4k';
  }
  if (/\b(?:8\s*k|7680\s*x\s*4320|4320p)\b/.test(normalizedQuery)) {
    return '8k';
  }
  return undefined;
}

function countSpecMatches(
  candidate: ProductCandidate,
  specs: ProductRetrievalConstraints['requiredSpecs'],
): number {
  if (!specs) return 0;
  return [
    specs.ramGb && candidateMatchesRamSpec(candidate, specs.ramGb),
    specs.ssdGb && candidateMatchesSsdSpec(candidate, specs.ssdGb),
    specs.gpu && candidateMatchesTextSpec(candidate, specs.gpu),
    specs.displayResolution &&
      candidateMatchesDisplayResolution(candidate, specs.displayResolution),
    specs.refreshRateHz &&
      candidateMatchesSpec(candidate, specs.refreshRateHz, ['hz']),
    specs.wireless && candidateMatchesWireless(candidate),
  ].filter(Boolean).length;
}

function candidateSatisfiesRequiredSpecs(
  candidate: ProductCandidate,
  specs: ProductRetrievalConstraints['requiredSpecs'],
): boolean {
  if (!specs) return true;
  if (specs.ramGb && !candidateMatchesRamSpec(candidate, specs.ramGb))
    return false;
  if (specs.ssdGb && !candidateMatchesSsdSpec(candidate, specs.ssdGb))
    return false;
  if (specs.gpu && !candidateMatchesTextSpec(candidate, specs.gpu))
    return false;
  if (
    specs.displayResolution &&
    !candidateMatchesDisplayResolution(candidate, specs.displayResolution)
  )
    return false;
  if (
    specs.refreshRateHz &&
    !candidateMatchesSpec(candidate, specs.refreshRateHz, ['hz'])
  )
    return false;
  if (specs.wireless && !candidateMatchesWireless(candidate)) return false;
  return true;
}

const RAM_SPEC_KEY_PATTERNS = [/\bram\b/, /\bmemory\b/, /\bbo nho\b/];
const SSD_SPEC_KEY_PATTERNS = [
  /\bssd\b/,
  /\bstorage\b/,
  /\bo cung\b/,
  /\bnvme\b/,
];

function candidateMatchesRamSpec(
  candidate: ProductCandidate,
  value: number,
): boolean {
  return candidateMatchesCapacitySpec(candidate, value, RAM_SPEC_KEY_PATTERNS);
}

function candidateMatchesSsdSpec(
  candidate: ProductCandidate,
  value: number,
): boolean {
  return candidateMatchesCapacitySpec(candidate, value, SSD_SPEC_KEY_PATTERNS);
}

function candidateMatchesCapacitySpec(
  candidate: ProductCandidate,
  value: number,
  keyPatterns: RegExp[],
): boolean {
  const valuePattern = new RegExp(`\\b${value}\\s*gb\\b`);
  return Object.entries(candidate.payload.normalizedSpecs ?? {}).some(
    ([key, raw]) => {
      const normalizedKey = normalizeText(key);
      if (!keyPatterns.some((pattern) => pattern.test(normalizedKey))) {
        return false;
      }
      return valuePattern.test(normalizeText(raw));
    },
  );
}

function candidateMatchesSpec(
  candidate: ProductCandidate,
  value: number,
  units: string[],
): boolean {
  const specText = candidateSpecText(candidate);
  const unitPattern = units.length ? `(?:\\s*(?:${units.join('|')}))?` : '';
  return new RegExp(`\\b${value}${unitPattern}\\b`).test(specText);
}

function candidateMatchesTextSpec(
  candidate: ProductCandidate,
  value: string,
): boolean {
  return candidateSpecText(candidate).includes(normalizeText(value));
}

function candidateMatchesDisplayResolution(
  candidate: ProductCandidate,
  value: string,
): boolean {
  const specText = candidateSpecText(candidate);
  const aliases = displayResolutionAliases(normalizeText(value));
  return aliases.some((alias) => alias.test(specText));
}

function displayResolutionAliases(value: string): RegExp[] {
  if (/\b(?:2\s*k|qhd|wqhd|2560\s*x\s*1440|1440p)\b/.test(value)) {
    return [
      /\b2\s*k\b/,
      /\bqhd\b/,
      /\bwqhd\b/,
      /\b2560\s*x\s*1440\b/,
      /\b1440p\b/,
    ];
  }
  if (/\b(?:4\s*k|uhd|3840\s*x\s*2160|2160p)\b/.test(value)) {
    return [/\b4\s*k\b/, /\buhd\b/, /\b3840\s*x\s*2160\b/, /\b2160p\b/];
  }
  if (/\b(?:8\s*k|7680\s*x\s*4320|4320p)\b/.test(value)) {
    return [/\b8\s*k\b/, /\b7680\s*x\s*4320\b/, /\b4320p\b/];
  }
  return [new RegExp(`\\b${escapeRegExp(value)}\\b`)];
}
function candidateMatchesWireless(candidate: ProductCandidate): boolean {
  const specText = candidateSpecText(candidate);
  return (
    specText.includes('wireless') ||
    specText.includes('khong day') ||
    specText.includes('bluetooth')
  );
}

function candidateSpecText(candidate: ProductCandidate): string {
  return normalizeText(
    Object.values(candidate.payload.normalizedSpecs ?? {}).join(' '),
  );
}

export function mergeRetrievalConstraints(
  extracted: ProductRetrievalConstraints,
  provided?: ProductRetrievalConstraints,
): ProductRetrievalConstraints {
  if (!provided) return extracted;
  const providedCategoryHints = uniqueStrings(provided.categoryHints ?? []);

  return {
    ...extracted,
    ...provided,
    categoryHints:
      providedCategoryHints.length > 0
        ? providedCategoryHints
        : uniqueStrings(extracted.categoryHints ?? []),
    categoryPath: uniqueStrings([
      ...(extracted.categoryPath ?? []),
      ...(provided.categoryPath ?? []),
    ]),
    semanticTags: uniqueStrings([
      ...(extracted.semanticTags ?? []),
      ...(provided.semanticTags ?? []),
    ]),
    useCases: uniqueStrings([
      ...(extracted.useCases ?? []),
      ...(provided.useCases ?? []),
    ]),
    targetUsers: uniqueStrings([
      ...(extracted.targetUsers ?? []),
      ...(provided.targetUsers ?? []),
    ]),
    minPrice: stricterMinPrice(extracted.minPrice, provided.minPrice),
    maxPrice: stricterMaxPrice(extracted.maxPrice, provided.maxPrice),
    inStockOnly: extracted.inStockOnly || provided.inStockOnly,
    requiredSpecs: {
      ...(extracted.requiredSpecs ?? {}),
      ...(provided.requiredSpecs ?? {}),
    },
  };
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const text = String(value ?? '').trim();
    const key = normalizeText(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

function stricterMinPrice(left?: number, right?: number): number | undefined {
  if (typeof left === 'number' && typeof right === 'number')
    return Math.max(left, right);
  return typeof left === 'number' ? left : right;
}

function stricterMaxPrice(left?: number, right?: number): number | undefined {
  if (typeof left === 'number' && typeof right === 'number')
    return Math.min(left, right);
  return typeof left === 'number' ? left : right;
}

function candidateText(candidate: ProductCandidate): string {
  const payload = candidate.payload;
  return normalizeText(
    [
      payload.name,
      payload.category,
      ...payload.categoryPath,
      ...payload.semanticTags,
      ...payload.useCases,
      ...payload.targetUsers,
      ...Object.values(payload.normalizedSpecs ?? {}),
    ].join(' '),
  );
}

function matchesAny(values: string[], queryTerms: Set<string>): boolean {
  return values.some((value) => queryTerms.has(normalizeText(value)));
}

function effectivePrice(candidate: ProductCandidate): number {
  return candidate.payload.discountPrice > 0
    ? candidate.payload.discountPrice
    : candidate.payload.price;
}

function splitQueryTerms(normalizedQuery: string): string[] {
  return normalizedQuery
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

function normalizeVectorScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(1, score)) * 2;
}

function normalizeBm25Score(score: number): number {
  if (!Number.isFinite(score) || score <= 0) return 0;
  return Math.min(1, Math.log1p(score) / Math.log1p(40));
}

function roundScore(score: number): number {
  return Math.round(score * 1000) / 1000;
}

function normalizedTextHasAlias(
  normalizedText: string,
  alias: string,
): boolean {
  return normalizedTextHasProductFamilyAlias(normalizedText, alias);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function normalizeText(value: unknown): string {
  return normalizeDictionaryText(value);
}
