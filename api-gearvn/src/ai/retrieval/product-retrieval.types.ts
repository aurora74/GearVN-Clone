export type ProductSearchPayload = {
  productId: string;
  name: string;
  slug: string;
  category: string;
  categoryPath: string[];
  price: number;
  discountPrice: number;
  stock: number;
  isPublished: boolean;
  isArchived: boolean;
  semanticTags: string[];
  useCases: string[];
  targetUsers: string[];
  normalizedSpecs?: Record<string, unknown>;
};

export type ProductSearchDocument = {
  productId: string;
  searchText: string;
  payload: ProductSearchPayload;
};

export type ProductRetrievalFilter = {
  category?: string;
  categoryPath?: string[];
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  semanticTags?: string[];
  useCases?: string[];
  targetUsers?: string[];
};

export type ProductRetrievalQuery = {
  original: string;
  expanded: string[];
  expandedText: string;
  constraints: ProductRetrievalConstraints;
};

export type ProductRetrievalConstraints = ProductRetrievalFilter & {
  categoryHints?: string[];
  requiredSpecs?: {
    ramGb?: number;
    ssdGb?: number;
    gpu?: string;
    displayResolution?: string;
    refreshRateHz?: number;
    wireless?: boolean;
  };
};

export type ProductCandidate = {
  productId: string;
  score: number;
  lexicalScore?: number;
  matchedTerms?: string[];
  matchedFields?: string[];
  source?: 'vector' | 'lexical' | 'hybrid';
  payload: ProductSearchPayload;
};

export type ProductRerankReason = {
  code:
    | 'exact_match'
    | 'keyword_match'
    | 'category_match'
    | 'spec_match'
    | 'price_compatible'
    | 'in_stock'
    | 'need_match'
    | 'target_user_match'
    | 'bm25_score'
    | 'vector_score';
  message: string;
  weight: number;
};

export type RerankedProductCandidate = ProductCandidate & {
  rerankScore: number;
  hybrid?: HybridRetrievalScore;
  reasons: ProductRerankReason[];
};

export type HybridRetrievalScore = {
  bm25Score: number;
  cosineScore: number;
  constraintScore: number;
  specScore: number;
  availabilityScore: number;
  rerankScore: number;
};

export type ProductCragRetryMetadata = {
  triggered: boolean;
  retryCount: number;
  reason?: string;
  originalQuery: string;
  rewrittenQuery?: string;
  relaxedConstraints: string[];
};

export type ProductRetrievalPipelineMode =
  | 'phase-09.2-baseline'
  | 'phase-10-improved';

export type ProductRetrievalAblationVariant =
  | 'dense_vector_only'
  | 'hybrid_no_rerank'
  | 'hybrid_rerank_no_expansion'
  | 'hybrid_rerank_expansion'
  | 'hybrid_rerank_rewrite'
  | 'phase_10_full';

export type ProductRetrievalRewriteMetadata = {
  rewrittenQuery: string;
  detectedIntents: string[];
  productGroups: string[];
  hardConstraints: ProductRetrievalConstraints;
  softSignals: string[];
  expandedKeywords: string[];
  comboGroups: string[];
  confidence?: number;
  metadata: {
    rewrite_provider: 'deepseek';
    rewrite_model: string;
    rewrite_status: string;
    rewrite_retry_count: number;
    rewrite_latency_ms: number;
    rewritten_query: string;
    rewrite_skipped_reason?: string;
  };
};

export type ProductRetrievalClarification = {
  needed: boolean;
  reason: string | null;
  questions?: string[];
};

export type ProductComboGroupResult = {
  id: string;
  label: string;
  query: string;
  results: RerankedProductCandidate[];
};

export type ProductGroupCoverage = {
  expectedGroups: string[];
  coveredGroups: string[];
  missingGroups: string[];
  coverageRate: number;
};

export type ProductRetrievalResult = {
  query: ProductRetrievalQuery;
  candidates: ProductCandidate[];
  lexicalCandidates?: ProductCandidate[];
  vectorCandidates?: ProductCandidate[];
  results: RerankedProductCandidate[];
  pipelineVersion?: ProductRetrievalPipelineMode;
  rewrite?: ProductRetrievalRewriteMetadata;
  clarification?: ProductRetrievalClarification;
  comboGroups?: ProductComboGroupResult[];
  groupCoverage?: ProductGroupCoverage;
  effectiveQuery?: string;
  relaxedConstraints?: string[];
  cragRetry?: ProductCragRetryMetadata;
  crag_retry?: ProductCragRetryMetadata;
  explanation?: string;
};

export type BenchmarkBinaryQrel = {
  productId: string;
  relevant: true;
  rationale: string;
};

export type ProductBenchmarkLabelSource =
  | 'manual_binary_qrels'
  | 'expected_product_ids'
  | 'expected_clarification'
  | 'category_corpus';

export type BenchmarkCase = {
  id: string;
  query: string;
  group:
    | 'keyword'
    | 'need_based'
    | 'gift'
    | 'technical'
    | 'combo'
    | 'ambiguous';
  expectedCategories: string[];
  expectedProductIds?: string[];
  expectedQrels?: BenchmarkBinaryQrel[];
  expectedIntents?: string[];
  expectedSpecs?: Record<string, unknown>;
  expectedComboGroups?: string[];
  expectedClarification?: boolean;
  expectedFailureNotes?: string[];
  hardConstraints?: ProductRetrievalConstraints;
};
export type RetrievalBenchmarkResult = {
  query: string;
  expectedProductIds: string[];
  candidates: ProductCandidate[];
  metrics: Record<string, number>;
};
