import { Injectable } from '@nestjs/common';

import { ProductIntentComboGroup } from './product-intent-primitives';
import {
  ProductComboGroupResult,
  ProductGroupCoverage,
  ProductRetrievalConstraints,
  ProductRetrievalPipelineMode,
  ProductRetrievalResult,
} from './product-retrieval.types';
import { ProductRetriever } from './product-retriever';

type ComboRetrieverSearchOptions = {
  topK: number;
  constraints: ProductRetrievalConstraints;
  pipeline: ProductRetrievalPipelineMode;
  signal?: AbortSignal;
};

@Injectable()
export class ProductComboRetrievalService {
  async searchCombo(input: {
    query: string;
    groups: ProductIntentComboGroup[];
    retriever: Pick<ProductRetriever, 'search'>;
    perGroupTopK?: number;
    signal?: AbortSignal;
  }): Promise<{
    groups: ProductComboGroupResult[];
    groupCoverage: ProductGroupCoverage;
  }> {
    const perGroupTopK = clampPerGroupTopK(input.perGroupTopK);
    const expectedGroups = uniqueGroups(input.groups);
    const groups: ProductComboGroupResult[] = [];
    const coveredGroups: string[] = [];

    for (const group of expectedGroups) {
      const query = buildGroupQuery(input.query, group);
      const constraints: ProductRetrievalConstraints = {
        categoryHints: [group],
      };
      const searchOptions: ComboRetrieverSearchOptions = {
        topK: perGroupTopK,
        constraints,
        pipeline: 'phase-09.2-baseline',
        signal: input.signal,
      };
      const result: ProductRetrievalResult = await input.retriever.search(
        query,
        searchOptions,
      );
      const results = result.results.slice(0, perGroupTopK);

      if (results.length > 0) {
        coveredGroups.push(group);
      }

      groups.push({
        id: group,
        label: labelForGroup(group),
        query,
        results,
      });
    }

    const missingGroups = expectedGroups.filter(
      (group) => !coveredGroups.includes(group),
    );

    return {
      groups,
      groupCoverage: {
        expectedGroups,
        coveredGroups,
        missingGroups,
        coverageRate:
          expectedGroups.length === 0
            ? 0
            : coveredGroups.length / expectedGroups.length,
      },
    };
  }
}

function clampPerGroupTopK(value: number | undefined): number {
  const normalized = Math.floor(value ?? 3);
  return Math.min(3, Math.max(1, Number.isFinite(normalized) ? normalized : 3));
}

function buildGroupQuery(query: string, group: ProductIntentComboGroup): string {
  return `${query} ${group}`.replace(/\s+/g, ' ').trim();
}

function labelForGroup(group: ProductIntentComboGroup): string {
  return group
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function uniqueGroups(groups: ProductIntentComboGroup[]): ProductIntentComboGroup[] {
  return Array.from(new Set(groups.filter(Boolean)));
}
