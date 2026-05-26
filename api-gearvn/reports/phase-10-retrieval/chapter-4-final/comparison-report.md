# Phase 10 Product Retrieval Comparison

## Architecture Notes

- Baseline pipeline: phase-09.2
- Improved pipeline: phase-10
- Rewrite model: deepseek-v4-pro
- Secret keys logged: false

## Experiment Design

- Cases evaluated: 80
- The same teacher-scoped fixtures are run through both retrieval pipelines.
- Metrics include Recall@10, Precision@5, MRR, nDCG@10, Failure Rate, Clarification Rate, and Group Coverage.
- Per-query rows expose labelSource, relevantSetSize, and topKRelevantHits so category-derived labels can be interpreted separately from explicit product IDs.

### Label Coverage

| Label source | Cases |
|--------------|-------|
| manual_binary_qrels | 40 |
| expected_product_ids | 32 |
| expected_clarification | 8 |
| category_corpus | 0 |
| nonAmbiguousUnlabeled | 0 |
| totalCases | 80 |

## Results

| Metric | Baseline | Improved | Delta |
|--------|----------|----------|-------|
| Recall@10 | 0.8981 | 0.9861 | 0.088 |
| Precision@5 | 0.5306 | 0.5889 | 0.0583 |
| MRR | 0.9063 | 0.9861 | 0.0798 |
| nDCG@10 | 0.8924 | 0.9861 | 0.0937 |
| Failure Rate | 0.175 | 0.0125 | -0.1625 |
| Clarification Rate | 0 | 0.1 | 0.1 |
| Group Coverage | 0 | 0.1412 | 0.1412 |

Relative gate: passed

## Limitations

- Report quality depends on the current Qdrant collection and product payload freshness.
- Category-derived relevance labels are stable for comparison but do not replace human graded judgments.
- Live benchmark execution requires configured retrieval service credentials.
