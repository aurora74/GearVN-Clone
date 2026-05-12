import { Injectable, Optional } from '@nestjs/common';

import {
  AssistantRecommendationLedgerEntry,
  AssistantResolvedProductContext,
} from '../assistant.types';
import { AssistantSessionService } from '../assistant-session.service';
import { ProductCatalogAdapter } from '../adapters/product-catalog.adapter';
import {
  isOrdinalRecommendationReference,
  parseRecommendationRankReference,
} from './recommendation-reference.util';

type ProductContextResolverInput = {
  roomId: string;
  userText: string;
  intent?: string;
  entities?: Record<string, unknown>;
};

type CandidateScore = {
  product: AssistantRecommendationLedgerEntry;
  score: number;
};

const FUZZY_CONFIDENCE_THRESHOLD = 0.72;
const AMBIGUITY_DELTA = 0.08;

const PRODUCT_FAMILY_REFERENCE_TERMS = new Set([
  'acer',
  'aorus',
  'asus',
  'cyborg',
  'dell',
  'gigabyte',
  'hp',
  'ideapad',
  'inspiron',
  'katana',
  'legion',
  'lenovo',
  'loq',
  'msi',
  'nitro',
  'omen',
  'predator',
  'rog',
  'tuf',
  'victus',
]);
@Injectable()
export class ProductContextResolver {
  constructor(
    private readonly sessionService: AssistantSessionService,
    @Optional() private readonly catalogAdapter?: ProductCatalogAdapter,
  ) {}

  async resolve(
    input: ProductContextResolverInput,
  ): Promise<AssistantResolvedProductContext> {
    const ledger = await this.sessionService.getLastRecommendationLedger(
      input.roomId,
    );
    const userText = input.userText ?? '';
    const lowerUserText = userText.toLowerCase();
    const productPhrase = extractProductPhrase(userText);

    const rank = parseRecommendationRankReference(userText)?.rank;
    if (rank) {
      const product = ledger.find((item) => item.rank === rank);
      if (product) return resolved(product, 'ledger.rank', 0.99);
      return unresolved();
    }

    const exactName = ledger.find((item) =>
      lowerUserText.includes(item.name.toLowerCase()),
    );
    if (exactName) return resolved(exactName, 'ledger.exact_name', 0.97);

    const slug = ledger.find(
      (item) =>
        typeof item.slug === 'string' &&
        userText.toLowerCase().includes(item.slug.toLowerCase()),
    );
    if (slug) return resolved(slug, 'ledger.slug', 0.94);

    const identifierToken = findExactIdentifierTokenMatch(
      ledger,
      productPhrase,
    );
    if (identifierToken) {
      return resolved(identifierToken, 'ledger.identifier_token', 0.93);
    }

    const familyCandidates = findFamilyReferenceCandidates(ledger, userText);
    if (familyCandidates.length > 1) {
      return clarificationRequired(familyCandidates.slice(0, 5), 0.7);
    }
    const normalizedName = findNormalizedNameMatch(ledger, productPhrase);
    if (normalizedName) {
      return resolved(normalizedName, 'ledger.normalized_name', 0.9);
    }

    const fuzzy = rankFuzzyMatches(ledger, productPhrase);
    if (fuzzy.length > 0) {
      const [best, second] = fuzzy;
      if (
        best.score >= FUZZY_CONFIDENCE_THRESHOLD &&
        (!second || best.score - second.score >= AMBIGUITY_DELTA)
      ) {
        return resolved(best.product, 'ledger.fuzzy_name', best.score);
      }

      return clarificationRequired(
        fuzzy.slice(0, 3).map((item) => item.product),
        best.score,
      );
    }

    if (ledger.length > 0 && isLatestRecommendationReference(userText)) {
      return resolved(ledger[0], 'ledger.latest_recommendation', 0.86);
    }

    if (isOrdinalRecommendationReference(userText)) return unresolved();

    for (const lookupQuery of catalogLookupQueries(input, productPhrase)) {
      const catalogProducts =
        (await this.catalogAdapter?.findProductDetailsByNameOrSlug(
          lookupQuery,
          5,
        )) ?? [];
      if (catalogProducts.length === 1) {
        return resolved(catalogProducts[0], 'catalog.name_search', 0.78);
      }
      if (catalogProducts.length > 1) {
        return clarificationRequired(catalogProducts, 0.65);
      }
    }

    return unresolved();
  }
}

function resolved(
  product: AssistantResolvedProductContext['product'],
  matchSource: string,
  confidence: number,
): AssistantResolvedProductContext {
  return {
    status: 'resolved',
    matchSource,
    confidence,
    product,
  };
}

function clarificationRequired(
  candidates: AssistantResolvedProductContext['candidates'] = [],
  confidence: number,
): AssistantResolvedProductContext {
  const names = candidates
    .map((candidate) => candidate.name)
    .filter(Boolean)
    .slice(0, 3);
  return {
    status: 'clarification_required',
    matchSource: 'clarification',
    confidence,
    candidates,
    clarification: {
      reason: 'ambiguous_product_reference',
      text: names.length
        ? `Mình thấy vài sản phẩm gần giống nhau: ${names.join(', ')}. Bạn muốn hỏi mẫu nào?`
        : 'Mình chưa chắc bạn đang hỏi sản phẩm nào. Bạn nói rõ tên hoặc số thứ tự giúp mình nhé.',
      candidates,
    },
  };
}

function unresolved(): AssistantResolvedProductContext {
  return {
    status: 'unresolved',
    matchSource: 'unresolved',
    confidence: 0,
    product: null,
  };
}

const CATALOG_LOOKUP_TRAILING_TERMS = new Set([
  'cau',
  'chi',
  'citation',
  'cong',
  'community',
  'de',
  'do',
  'gi',
  'hinh',
  'khai',
  'mang',
  'nao',
  'nguon',
  'nhu',
  'noi',
  'public',
  'ra',
  'sao',
  'sau',
  'so',
  'source',
  'spec',
  'thong',
  'tin',
  'tu',
  'van',
  'vua',
  'web',
  'xuat',
]);

function catalogLookupQueries(
  input: ProductContextResolverInput,
  productPhrase: string,
): string[] {
  return uniqueNonEmpty([
    asNonEmptyString(input.entities?.productName),
    extractNamedProductQuery(input.userText),
    trimCatalogLookupPhrase(productPhrase),
    productPhrase,
    input.userText,
  ]);
}

function extractNamedProductQuery(text: string): string | undefined {
  const tokens = meaningfulTokens(text);
  const firstFamilyIndex = tokens.findIndex((token) =>
    PRODUCT_FAMILY_REFERENCE_TERMS.has(token),
  );
  if (firstFamilyIndex < 0) return undefined;
  return trimCatalogLookupPhrase(tokens.slice(firstFamilyIndex).join(' '));
}

function trimCatalogLookupPhrase(value: string): string | undefined {
  const tokens = meaningfulTokens(value);
  const trailingIndex = tokens.findIndex(
    (token, index) => index >= 3 && CATALOG_LOOKUP_TRAILING_TERMS.has(token),
  );
  const trimmed = trailingIndex >= 3 ? tokens.slice(0, trailingIndex) : tokens;
  return trimmed.length >= 2 ? trimmed.join(' ') : undefined;
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function uniqueNonEmpty(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  return values.filter((value): value is string => {
    const normalized = value?.trim();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function findNormalizedNameMatch(
  ledger: AssistantRecommendationLedgerEntry[],
  productPhrase: string,
): AssistantRecommendationLedgerEntry | null {
  const phraseTokens = meaningfulTokens(productPhrase);
  if (phraseTokens.length < 3) return null;
  const phrase = phraseTokens.join(' ');

  const matches = ledger.filter((item) => {
    const normalizedName = normalizeText(item.normalizedName ?? item.name);
    return normalizedName.includes(phrase) || phrase.includes(normalizedName);
  });
  return matches.length === 1 ? matches[0] : null;
}

function findExactIdentifierTokenMatch(
  ledger: AssistantRecommendationLedgerEntry[],
  productPhrase: string,
): AssistantRecommendationLedgerEntry | null {
  const identifierTokens =
    meaningfulTokens(productPhrase).filter(isIdentifierToken);
  if (identifierTokens.length === 0) return null;

  const matches = ledger
    .map((item) => {
      const productTokens = new Set(
        meaningfulTokens(item.normalizedName ?? item.name),
      );
      const matchedCount = identifierTokens.filter((token) =>
        productTokens.has(token),
      ).length;
      return { item, matchedCount };
    })
    .filter((match) => match.matchedCount > 0)
    .sort((left, right) => right.matchedCount - left.matchedCount);

  const [best, second] = matches;
  if (!best || best.matchedCount === second?.matchedCount) return null;
  return best.item;
}

function findFamilyReferenceCandidates(
  ledger: AssistantRecommendationLedgerEntry[],
  userText: string,
): AssistantRecommendationLedgerEntry[] {
  const requestedTokens = new Set(
    meaningfulTokens(userText).filter((token) =>
      PRODUCT_FAMILY_REFERENCE_TERMS.has(token),
    ),
  );
  if (requestedTokens.size === 0) return [];

  const hasAlternative = /\b(hoac|hay|or)\b|\//.test(normalizeText(userText));
  return ledger.filter((item) => {
    const productTokens = meaningfulTokens(item.normalizedName ?? item.name);
    const matchedCount = Array.from(requestedTokens).filter((token) =>
      productTokens.some((candidate) => tokenMatches(token, candidate)),
    ).length;
    return hasAlternative ? matchedCount >= 1 : matchedCount >= 2;
  });
}
function rankFuzzyMatches(
  ledger: AssistantRecommendationLedgerEntry[],
  productPhrase: string,
): CandidateScore[] {
  const phraseTokens = meaningfulTokens(productPhrase);
  if (phraseTokens.length < 2) return [];

  return ledger
    .map((product) => ({
      product,
      score: fuzzyTokenScore(
        phraseTokens,
        meaningfulTokens(product.normalizedName ?? product.name),
      ),
    }))
    .filter((item) => item.score >= 0.5)
    .sort((left, right) => right.score - left.score);
}

function fuzzyTokenScore(inputTokens: string[], candidateTokens: string[]) {
  if (inputTokens.length === 0 || candidateTokens.length === 0) return 0;

  const matched = inputTokens.filter((token) =>
    candidateTokens.some((candidate) => tokenMatches(token, candidate)),
  ).length;
  return matched / Math.max(inputTokens.length, candidateTokens.length * 0.6);
}

function tokenMatches(left: string, right: string): boolean {
  if (left === right) return true;
  if (left.length >= 4 && right.includes(left)) return true;
  if (right.length >= 4 && left.includes(right)) return true;
  return levenshteinDistance(left, right) <= 1;
}

function isIdentifierToken(token: string): boolean {
  return token.length >= 5 && /[a-z]/.test(token) && /\d/.test(token);
}

function isLatestRecommendationReference(text: string): boolean {
  const normalized = normalizeText(text);
  return /\b(?:mau|con|cai|san pham)?\s*(?:vua tu van|vua goi y|vua de xuat|vua recommend|vua neu|o tren|ben tren|moi tu van|moi goi y)\b/.test(
    normalized,
  );
}

function extractProductPhrase(text: string): string {
  return meaningfulTokens(text).join(' ');
}

function meaningfulTokens(text: string): string[] {
  const stopWords = new Set([
    'review',
    'add',
    'ban',
    'can',
    'cart',
    'cau',
    'chi',
    'cho',
    'chon',
    'cai',
    'con',
    'cua',
    'dat',
    'de',
    'duoc',
    'em',
    'gio',
    'giup',
    'hang',
    'hay',
    'hinh',
    'hoac',
    'hon',
    'khong',
    'ko',
    'lay',
    'mau',
    'minh',
    'mo',
    'mua',
    'nao',
    'nha',
    'nhe',
    'nhu',
    'o',
    'pham',
    'ra',
    'sao',
    'san',
    'so',
    'them',
    'thong',
    'tiet',
    'tin',
    'toi',
    'tren',
    'tu',
    'van',
    'vao',
    've',
    'vua',
    'xuat',
  ]);
  return normalizeText(text)
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !stopWords.has(token));
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshteinDistance(left: string, right: string): number {
  const distances = Array.from({ length: left.length + 1 }, (_, index) => [
    index,
  ]);
  for (let index = 1; index <= right.length; index += 1) {
    distances[0][index] = index;
  }

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      distances[leftIndex][rightIndex] = Math.min(
        distances[leftIndex - 1][rightIndex] + 1,
        distances[leftIndex][rightIndex - 1] + 1,
        distances[leftIndex - 1][rightIndex - 1] + cost,
      );
    }
  }

  return distances[left.length][right.length];
}
