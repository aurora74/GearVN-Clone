import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import {
  ProductCandidate,
  ProductRetrievalConstraints,
  ProductRetrievalFilter,
  RerankedProductCandidate,
} from './product-retrieval.types';
import {
  expandProductQuery,
  extractHardConstraints,
  mergeRetrievalConstraints,
  rerankProducts,
} from './product-reranker';

type GraphConfig = {
  configurable?: {
    embedder?: {
      embedQuery(text: string): Promise<{ vectors: number[][] } | number[]>;
    };
    vector?: {
      queryProducts(
        vector: number[],
        options: { limit?: number; filters?: ProductRetrievalFilter },
      ): Promise<ProductCandidate[]>;
    };
  };
};

export type ProductRetrievalGraphState = {
  query: string;
  topK?: number;
  filters?: ProductRetrievalFilter;
  hardConstraints?: ProductRetrievalConstraints;
  expandedQueries: string[];
  embedding: number[];
  candidates: ProductCandidate[];
  reranked: RerankedProductCandidate[];
  errors: string[];
};

const ProductRetrievalState = Annotation.Root({
  query: Annotation<string>,
  topK: Annotation<number | undefined>,
  filters: Annotation<ProductRetrievalFilter | undefined>,
  hardConstraints: Annotation<ProductRetrievalConstraints | undefined>,
  expandedQueries: Annotation<string[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  embedding: Annotation<number[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  candidates: Annotation<ProductCandidate[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  reranked: Annotation<RerankedProductCandidate[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  errors: Annotation<string[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
});

export async function expandQueryNode(
  state: Partial<ProductRetrievalGraphState>,
): Promise<Partial<ProductRetrievalGraphState>> {
  return { expandedQueries: expandProductQuery(state.query ?? '') };
}

export async function embedQueryNode(
  state: Partial<ProductRetrievalGraphState>,
  config?: GraphConfig,
): Promise<Partial<ProductRetrievalGraphState>> {
  if (state.errors?.length) return {};

  const embedder = config?.configurable?.embedder;
  if (!embedder) return { errors: ['Missing graph embedder'] };

  const result = await embedder.embedQuery(
    [state.query, ...(state.expandedQueries ?? [])].join(' | '),
  );
  const embedding = Array.isArray(result) ? result : (result.vectors[0] ?? []);
  return embedding.length ? { embedding } : { errors: ['Missing query embedding'] };
}

export async function vectorSearchNode(
  state: Partial<ProductRetrievalGraphState>,
  config?: GraphConfig,
): Promise<Partial<ProductRetrievalGraphState>> {
  if (state.errors?.length) return {};

  const vector = config?.configurable?.vector;
  if (!vector) return { errors: ['Missing graph vector searcher'] };
  if (!state.embedding?.length) return { errors: ['Missing query embedding'] };

  const candidates = await vector.queryProducts(state.embedding, {
    limit: Math.max(state.topK ?? 10, 30),
    filters: vectorFilters(graphConstraints(state)),
  });

  return { candidates };
}

export async function rerankNode(
  state: Partial<ProductRetrievalGraphState>,
): Promise<Partial<ProductRetrievalGraphState>> {
  if (state.errors?.length) return {};

  return {
    reranked: rerankProducts(state.query ?? '', state.candidates ?? [], {
      topK: state.topK ?? 10,
      constraints: graphConstraints(state),
      enforceRequiredSpecs: true,
    }),
  };
}

function graphConstraints(
  state: Partial<ProductRetrievalGraphState>,
): ProductRetrievalConstraints {
  return mergeRetrievalConstraints(
    extractHardConstraints(state.query ?? ''),
    mergeRetrievalConstraints(state.filters ?? {}, state.hardConstraints),
  );
}

function vectorFilters(constraints: ProductRetrievalConstraints): ProductRetrievalFilter {
  return {
    category: constraints.category,
    categoryPath: constraints.categoryPath,
    minPrice: constraints.minPrice,
    maxPrice: constraints.maxPrice,
    inStockOnly: constraints.inStockOnly,
    semanticTags: constraints.semanticTags,
    useCases: constraints.useCases,
    targetUsers: constraints.targetUsers,
  };
}

export const productRetrievalGraph = new StateGraph(ProductRetrievalState)
  .addNode('expand_query', expandQueryNode)
  .addNode('embed_query', embedQueryNode)
  .addNode('vector_search', vectorSearchNode)
  .addNode('rerank', rerankNode)
  .addEdge(START, 'expand_query')
  .addEdge('expand_query', 'embed_query')
  .addEdge('embed_query', 'vector_search')
  .addEdge('vector_search', 'rerank')
  .addEdge('rerank', END)
  .compile();
