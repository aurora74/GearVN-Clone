# Retrieval Gate

Status: needs_remediation

- Secret keys logged: false
- Selected cases: 80
- Final completed cases: 80
- Expected complete cases: 80
- Relative gate passed: true
- Improved pipeline failures: 1

## Label coverage

| Label source | Cases |
|--------------|-------|
| manual_binary_qrels | 40 |
| expected_product_ids | 32 |
| expected_clarification | 8 |
| category_corpus | 0 |
| nonAmbiguousUnlabeled | 0 |
| totalCases | 80 |

## Metrics

| Metric | Baseline | Improved | Delta |
|--------|----------|----------|-------|
| Recall@10 | 0.8981 | 0.9861 | 0.088 |
| Precision@5 | 0.5306 | 0.5889 | 0.0583 |
| MRR | 0.9063 | 0.9861 | 0.0798 |
| nDCG@10 | 0.8924 | 0.9861 | 0.0937 |
| Failure Rate | 0.175 | 0.0125 | -0.1625 |
| Clarification Rate | 0 | 0.1 | 0.1 |
| Group Coverage | 0 | 0.1412 | 0.1412 |

## Failures

- phase-09.2-baseline need-home-office: No relevant product matched expected categories: monitor, man-hinh, keyboard, mouse, webcam
- phase-09.2-baseline gift-office-worker: No relevant product matched expected categories: keyboard, mouse, monitor, man-hinh, phu-kien
- phase-09.2-baseline combo-home-work-kit: No relevant product matched expected categories: monitor, man-hinh, keyboard, mouse, webcam, phu-kien
- phase-09.2-baseline ambiguous-strong-value: Expected clarification was not produced
- phase-09.2-baseline ambiguous-study-machine: Expected clarification was not produced
- phase-09.2-baseline ambiguous-good-laptop: Expected clarification was not produced
- phase-09.2-baseline ambiguous-essential-accessories: Expected clarification was not produced
- phase-09.2-baseline gift-parents-smartwatch: No relevant product matched expected categories: watch, smartwatch, dong-ho-thong-minh
- phase-09.2-baseline technical-rtx4060-16gb-under-30m: No relevant product matched expected categories: laptop
- phase-09.2-baseline combo-basic-gaming-pc-build: No relevant product matched expected categories: desktop, pc, cpu, mainboard, ram, ssd, psu, case, linh-kien-may-tinh
- phase-09.2-baseline ambiguous-strong-config-value: Expected clarification was not produced
- phase-09.2-baseline ambiguous-learning-machine: Expected clarification was not produced
- phase-09.2-baseline ambiguous-worth-buying-laptop: Expected clarification was not produced
- phase-09.2-baseline ambiguous-accessories-to-buy: Expected clarification was not produced
- phase-10-improved technical-rtx4060-16gb-under-30m: No relevant product matched expected categories: laptop
