# Phase 12 Product Retrieval Ablation

## Experiment Design

- Secret keys logged: false
- Variants: dense_vector_only, hybrid_no_rerank, hybrid_rerank_no_expansion, hybrid_rerank_expansion, hybrid_rerank_rewrite, phase_10_full
- Each variant is evaluated with the same benchmark cases, relevance labels, topK, and metric formulas.
- Metrics include Recall@10, Precision@5, MRR, nDCG@10, Failure Rate, Clarification Rate, and Group Coverage.

### Label Coverage

| Label source | Cases |
|--------------|-------|
| manual_binary_qrels | 40 |
| expected_product_ids | 32 |
| expected_clarification | 8 |
| category_corpus | 0 |
| nonAmbiguousUnlabeled | 0 |
| totalCases | 80 |

## Variant Results

| Variant | Recall@10 | Precision@5 | MRR | nDCG@10 | Failure Rate | Clarification Rate | Group Coverage |
|---------|--------|--------|--------|--------|--------|--------|--------|
| dense_vector_only | 0.3519 | 0.1306 | 0.2658 | 0.2494 | 0.5375 | 0 | 0 |
| hybrid_no_rerank | 0.3519 | 0.1278 | 0.2658 | 0.2492 | 0.5375 | 0 | 0 |
| hybrid_rerank_no_expansion | 0.331 | 0.1194 | 0.2615 | 0.2401 | 0.5625 | 0 | 0 |
| hybrid_rerank_expansion | 0.6806 | 0.3417 | 0.5931 | 0.5964 | 0.325 | 0 | 0 |
| hybrid_rerank_rewrite | 0.7917 | 0.4056 | 0.695 | 0.7048 | 0.125 | 0.1 | 0 |
| phase_10_full | 0.7824 | 0.4 | 0.673 | 0.6848 | 0.1125 | 0.1 | 0.1593 |

## Component Impact

| Component | Recall@10 | Precision@5 | MRR | nDCG@10 | Failure Rate | Clarification Rate | Group Coverage |
|-----------|--------|--------|--------|--------|--------|--------|--------|
| hybrid | 0 | -0.0028 | 0 | -0.0002 | 0 | 0 | 0 |
| reranking | -0.0209 | -0.0084 | -0.0043 | -0.0091 | 0.025 | 0 | 0 |
| query_expansion | 0.3496 | 0.2223 | 0.3316 | 0.3563 | -0.2375 | 0 | 0 |
| query_rewrite | 0.1111 | 0.0639 | 0.1019 | 0.1084 | -0.2 | 0.1 | 0 |
| full_pipeline | -0.0093 | -0.0056 | -0.022 | -0.02 | -0.0125 | 0 | 0.1593 |

## Limitations

- Ablation values are benchmark evidence for thesis reporting and do not change production assistant behavior.
- Report quality depends on the current MongoDB catalog, Qdrant payload freshness, and configured retrieval credentials.
- Missing or timed-out external services should be recorded as blocked-run evidence rather than fabricated metric values.
