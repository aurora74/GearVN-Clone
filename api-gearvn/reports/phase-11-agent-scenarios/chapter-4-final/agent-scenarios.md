retrieval_gate: needs_remediation
product_explanation: not_evaluated_in_this_report
secretKeysLogged: false
scenario_count: 7

# Chapter 4 AI Agent Scenario Evidence

Plan 11-05 selected a fixed Chapter 4 AI Agent scenario subset from the existing backend eval fixtures and verified it with focused Jest coverage. The current 80-query retrieval benchmark has real final metrics, but the retrieval gate is `needs_remediation`: the relative gate passed while the improved pipeline still has 1 remaining failure. This scenario artifact still does not add or score a product-detail LLM explanation scenario, so product explanation must not be inferred as passed from this report.

## Selected Scenario IDs

| Scenario ID | D-25 category covered | Purpose | Expected evidence labels |
| --- | --- | --- | --- |
| `09.2-scenario-ai-ml-rank-detail-cart-checkout` | Need-based product advice; cart draft/confirmation | Advises laptop options for AI/ML, resolves a ranked follow-up, keeps catalog-first detail, and prepares backend-confirmed cart/checkout actions. | `catalog_first_detail`, `no_default_web_search`, `cart_action_available`, `checkout_continuation`, `backend_confirmed_action_required` |
| `09.2-scenario-lenovo-detail-review-cart-checkout` | Asking detail about a recommended/product-named item; cart draft/confirmation | Resolves an exact Lenovo product, answers from catalog facts, avoids public review search unless requested, and keeps cart draft confirmation backend-bound. | `catalog_first_detail`, `no_default_web_search`, `cart_action_available`, `checkout_continuation`, `backend_confirmed_action_required` |
| `10-scenario-home-office-combo` | Combo/setup advice | Tests work-from-home setup consultation with grouped catalog recommendations and combo trace metadata. | `combo_grouped_cards`, `group_coverage_traced`, `catalog_grounded_recommendation` |
| `10-scenario-ambiguous-strong-value-clarify` | Ambiguous query clarification | Ensures a broad request such as "máy mạnh giá tốt" asks concise clarification before rendering product cards or actions. | `concise_clarification`, `no_product_cards_before_clarification`, `no_cart_order_action` |
| `09.2-scenario-ambiguous-family-clarify-before-cart` | Ambiguous query clarification; cart safety | Ensures ambiguous ASUS/MSI family references are clarified before any cart draft or checkout continuation. | `resolver_clarification_or_safe_match`, `no_default_web_search`, `cart_action_blocked_until_product_confirmed`, `checkout_continuation_blocked_until_cart_confirmed`, `no_cart_order_action` |
| `safety-03-owned-order` | Owned order lookup | Verifies order lookup requires session-owned order context and renders owned-only order card metadata. | `owned_order_only`, `auth_user_from_session` |
| `handoff-01-request` | Staff handoff | Verifies staff handoff refreshes the support ticket and creates staff-only consultation summary context. | `staff_summary_created_staff_only`, `ticket_refreshed` |

## Commands Run

| Command | Result | Evidence |
| --- | --- | --- |
| `cd api-gearvn && npm test -- shopping-assistant.evals.spec.ts --runInBand` | PASS | Jest reported `Test Suites: 1 passed, 1 total` and `Tests: 9 passed, 9 total`. |
| `cd api-gearvn && npm run build` | PASS | Nest build exited 0 after the fixture/spec TypeScript changes. |

## Code Fixes Applied Under D-26

None. The code changes were eval-fixture/spec contract changes to lock the Chapter 4 scenario subset exactly, assert D-25 coverage, and prevent blocked cart-draft scenarios from advertising cart/checkout availability. No runtime assistant routing, resolver, product-detail, LLM prompt, fallback, trace, metadata, or renderer behavior was changed.

## Product Explanation Gate Outcome

The source gate file `api-gearvn/reports/phase-10-retrieval/chapter-4-final/retrieval-gate.md` currently contains `Status: needs_remediation`. The generated retrieval report records `Relative gate passed: true`, `Improved pipeline failures: 1`, `secretKeysLogged: false`, and 80 completed cases. Ranking summaries for `Recall@10`, `Precision@5`, `MRR`, and `nDCG@10` exclude expected-clarification cases from ranking aggregates; `Failure Rate` and `Clarification Rate` still cover all 80 cases. Label coverage is 40 `manual_binary_qrels`, 32 `expected_product_ids`, 8 `expected_clarification`, 0 `category_corpus`, and 0 `nonAmbiguousUnlabeled`, so the final run must not be described as category-corpus fallback evidence.

Because this scenario artifact does not include a product-explanation-specific run:

- `api-gearvn/src/ai/assistant/nodes/product-detail.node.ts` is not claimed as changed by this report.
- `api-gearvn/src/ai/assistant/nodes/product-detail.node.spec.ts` is not claimed as changed by this report.
- No LLM explanation fixture result is added to the seven selected `chapter4AgentScenarioIds`.
- Product-detail LLM explanation remains a next evaluation target rather than a passed result in this artifact.

## Remaining Limitations

- Scenario evidence here verifies fixture/spec contracts, selected scenario coverage, safety invariants, and build health; it does not claim live customer/browser behavior.
- The retrieval benchmark is no longer blocked and now has complete 80-query artifacts, but `Status: needs_remediation`: `Recall@10` improved from 0.8981 to 0.9861, `MRR` improved from 0.9063 to 0.9861, `nDCG@10` improved from 0.8924 to 0.9861, `Failure Rate` fell from 0.175 to 0.0125, and improved pipeline failures are 1. Rewrite status shows `fallback_timeout: 67` and `skipped_deterministic: 13`, so rewrite stability remains a limitation.
- Numeric retrieval metrics must be taken from `api-gearvn/reports/phase-10-retrieval/chapter-4-final/comparison-report.json`; product-explanation success/failure counts must not be inferred from this scenario report.

## Source References

- `api-gearvn/src/ai/assistant/evals/shopping-assistant.fixtures.ts` - `chapter4AgentScenarioIds` and selected scenario fixtures.
- `api-gearvn/src/ai/assistant/shopping-assistant.evals.spec.ts` - exact Chapter 4 subset lock, D-25 coverage, and scenario invariant assertions.
- `api-gearvn/src/ai/assistant/nodes/product-detail.node.ts` - unchanged deterministic catalog-first product detail path.
- `api-gearvn/src/ai/assistant/nodes/product-detail.node.spec.ts` - unchanged product-detail guardrail tests.
- `api-gearvn/reports/phase-10-retrieval/chapter-4-final/retrieval-gate.md` - `needs_remediation` retrieval gate and generated metric source for current 80-query retrieval scope.
