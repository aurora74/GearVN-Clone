import { z } from 'zod';

import {
  ReviewSearchClient,
  ReviewSearchProductContext,
  ReviewSearchSource,
  ReviewSourceClaim,
} from '../adapters/review-search.client';

export { ReviewSearchClient } from '../adapters/review-search.client';

const citationSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  source: z.string().optional(),
});

const claimSchema = z.object({
  text: z.string(),
  evidenceKind: z.string(),
  citations: z.array(citationSchema).min(1),
  uncertainty: z.string().optional(),
});

const claimGroupSchema = z.object({
  label: z.string(),
  claims: z.array(claimSchema),
});

export const ReviewSummarySchema = z.object({
  heading: z.literal('Tóm tắt đánh giá từ nguồn công khai'),
  summary: z.string(),
  repeatedFindings: claimGroupSchema,
  needsVerification: claimGroupSchema,
  insufficientSources: claimGroupSchema,
  citations: z.array(citationSchema),
  uncertainty: z.array(z.string()),
});

const reviewSourceClaimSchema = z.object({
  text: z.string(),
  evidenceStrength: z.string(),
  uncertainty: z.string().optional(),
});

const reviewSearchSourceSchema = z.object({
  title: z.string().default(''),
  url: z.string().default(''),
  source: z.string().optional(),
  publishedAt: z.string().optional(),
  snippet: z.string().optional(),
  claims: z.array(reviewSourceClaimSchema).default([]),
});
type ReviewSummaryState = {
  userText: string;
  intentPlan?: {
    needsProductRetrieval?: boolean;
    needsReviewSummary?: boolean;
    comparedProductIds?: string[];
    publicSourcesRequested?: boolean;
  };
  intent?: string;
  productContext?: {
    productId?: string;
    product?: {
      productId?: string;
      name?: string;
      slug?: string;
    } | null;
  };
};

type ReviewSummaryConfig = {
  reviewSearchClient: ReviewSearchClient;
  abortSignal?: AbortSignal;
};

type ReviewSummaryClaim = z.infer<typeof claimSchema>;

export async function reviewSummaryNode(
  state: ReviewSummaryState,
  config: ReviewSummaryConfig,
): Promise<any> {
  if (!shouldRunReviewSummary(state)) {
    return {
      intent: 'REVIEW_SUMMARY',
      nodeName: 'review_summary',
      text: '',
      metadata: {},
    };
  }

  const productContext = reviewSearchProductContext(state);
  const sources = sanitizeReviewSources(
    await searchReviewSourcesSafely(
      config.reviewSearchClient,
      state.userText,
      productContext,
      config.abortSignal,
    ),
  );
  const summary = buildReviewSummarySafely(sources);
  const hasClaims =
    summary.repeatedFindings.claims.length > 0 ||
    summary.needsVerification.claims.length > 0 ||
    summary.insufficientSources.claims.length > 0;

  return {
    intent: 'REVIEW_SUMMARY',
    nodeName: 'review_summary',
    text: hasClaims
      ? 'Mình đã tóm tắt các điểm được nhắc trong nguồn đánh giá công khai và tách phần cần kiểm chứng.'
      : 'Mình chưa đủ nguồn đáng tin cậy để tóm tắt đánh giá. Bạn có muốn chat với nhân viên tư vấn không?',
    metadata: {
      reviewSummary: summary,
    },
  };
}

function shouldRunReviewSummary(state: ReviewSummaryState): boolean {
  if (state.intent === 'REVIEW_SUMMARY') return true;
  if (state.intentPlan?.needsReviewSummary === true) return true;
  if (state.intentPlan?.publicSourcesRequested === true) return true;
  return hasExplicitPublicSourceRequest(state.userText);
}

const PUBLIC_REVIEW_REQUEST_PATTERNS = [
  'nguồn công khai',
  'trên mạng',
  'review cộng đồng',
  'web',
  'citation',
  'trích dẫn',
  'public source',
  'public review',
  'community review',
];

function hasExplicitPublicSourceRequest(userText: string): boolean {
  const normalized = normalizeText(userText);
  return PUBLIC_REVIEW_REQUEST_PATTERNS.some((pattern) =>
    normalized.includes(normalizeText(pattern)),
  );
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

function reviewSearchProductContext(
  state: ReviewSummaryState,
): ReviewSearchProductContext[] {
  const product = state.productContext?.product;
  const context = {
    productId: product?.productId ?? state.productContext?.productId,
    name: product?.name,
    slug: product?.slug,
  };
  return context.productId || context.name || context.slug ? [context] : [];
}

async function searchReviewSourcesSafely(
  reviewSearchClient: ReviewSummaryConfig['reviewSearchClient'],
  userText: string,
  productContext: ReviewSearchProductContext[],
  signal?: AbortSignal,
): Promise<ReviewSearchSource[]> {
  try {
    return await reviewSearchClient.search(userText, productContext, { signal });
  } catch {
    return [];
  }
}

function sanitizeReviewSources(sources: unknown): ReviewSearchSource[] {
  if (!Array.isArray(sources)) return [];
  return sources.flatMap((source) => {
    const parsed = reviewSearchSourceSchema.safeParse(source);
    return parsed.success ? [parsed.data] : [];
  });
}

function buildReviewSummarySafely(sources: ReviewSearchSource[]) {
  try {
    return buildReviewSummary(sources);
  } catch {
    return buildReviewSummary([]);
  }
}

function buildReviewSummary(sources: ReviewSearchSource[]) {
  const repeatedFindings: ReviewSummaryClaim[] = [];
  const needsVerification: ReviewSummaryClaim[] = [];
  const citations = new Map<string, ReviewSummaryClaim['citations'][number]>();
  const uncertainty = new Set<string>();

  for (const source of sources) {
    const citation = citationFromSource(source);
    if (!citation) continue;
    citations.set(citation.url, citation);

    for (const claim of source.claims ?? []) {
      const safeClaim = claimFromSource(claim, citation);
      if (!safeClaim) continue;
      if (safeClaim.uncertainty) uncertainty.add(safeClaim.uncertainty);

      if (claim.evidenceStrength === 'repeated') {
        repeatedFindings.push(safeClaim);
      } else {
        needsVerification.push(safeClaim);
      }
    }
  }

  const summaryText = buildReviewSummaryText(
    repeatedFindings,
    needsVerification,
  );

  const summary = {
    heading: 'Tóm tắt đánh giá từ nguồn công khai' as const,
    summary: summaryText,
    repeatedFindings: {
      label: 'Nhiều nguồn cùng nhắc',
      claims: repeatedFindings,
    },
    needsVerification: {
      label: 'Cần kiểm chứng',
      claims: needsVerification,
    },
    insufficientSources: {
      label: 'Chưa đủ nguồn',
      claims: [],
    },
    citations: Array.from(citations.values()),
    uncertainty: Array.from(uncertainty),
  };

  return ReviewSummarySchema.parse(summary);
}

function buildReviewSummaryText(
  repeatedFindings: ReviewSummaryClaim[],
  needsVerification: ReviewSummaryClaim[],
): string {
  const repeatedTexts = repeatedFindings.map((claim) => claim.text);
  if (repeatedTexts.length > 0) {
    return `Các nguồn công khai cùng nhắc: ${repeatedTexts.slice(0, 2).join(' ')}`;
  }

  const verificationTexts = needsVerification.map((claim) => claim.text);
  if (verificationTexts.length > 0) {
    return `Nguồn công khai có tín hiệu cần kiểm chứng: ${verificationTexts
      .slice(0, 2)
      .join(' ')}`;
  }

  return 'Chưa đủ nguồn đáng tin cậy để tóm tắt đánh giá.';
}

function citationFromSource(
  source: ReviewSearchSource,
): ReviewSummaryClaim['citations'][number] | null {
  if (!/^https:\/\//i.test(source.url || '')) return null;

  return {
    title: stripHtml(source.title || source.source || source.url),
    url: source.url,
    source: source.source ? stripHtml(source.source) : undefined,
  };
}

function claimFromSource(
  claim: ReviewSourceClaim,
  citation: ReviewSummaryClaim['citations'][number],
): ReviewSummaryClaim | null {
  const text = stripHtml(claim.text);
  if (!text || claim.evidenceStrength === 'unsupported') return null;

  const weakEvidence = [
    'weak',
    'stale',
    'sponsored',
    'variant-specific',
    'conflicting',
  ].includes(claim.evidenceStrength);

  return {
    text,
    evidenceKind: claim.evidenceStrength,
    citations: [citation],
    uncertainty: weakEvidence
      ? stripHtml(
          claim.uncertainty ||
            'Nguồn còn hạn chế, cần đối chiếu thêm trước khi kết luận.',
        )
      : undefined,
  };
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
