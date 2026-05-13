import { Injectable } from '@nestjs/common';

import {
  ProductIntentComboGroup,
  isValidProductIntentComboGroup,
} from './product-intent-primitives';
import {
  ProductComboGroupResult,
  ProductGroupCoverage,
  ProductRetrievalConstraints,
  ProductRetrievalPipelineMode,
  ProductRetrievalResult,
} from './product-retrieval.types';
import { ProductRetriever } from './product-retriever';
import { mergeRetrievalConstraints } from './product-reranker';

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
    constraints?: ProductRetrievalConstraints;
    retriever: Pick<ProductRetriever, 'search'>;
    perGroupTopK?: number;
    signal?: AbortSignal;
    maxDurationMs?: number;
    concurrency?: number;
    maxGroups?: number;
  }): Promise<{
    groups: ProductComboGroupResult[];
    groupCoverage: ProductGroupCoverage;
  }> {
    const perGroupTopK = clampPerGroupTopK(input.perGroupTopK);
    const requestedGroups = explicitRequestedComboGroups(input.query);
    const expectedGroups = prioritizeComboGroups(
      input.query,
      uniqueGroups(input.groups).filter(isValidProductIntentComboGroup),
      requestedGroups,
    );
    const groupLimit = clampGroupLimit(input.maxGroups, expectedGroups.length);
    const searchGroups = capProtectedSearchGroups(
      expectedGroups,
      requestedGroups,
      groupLimit,
    );
    const concurrency = clampConcurrency(
      input.concurrency,
      searchGroups.length,
    );
    const budgetMs = clampBudgetMs(input.maxDurationMs);
    const startedAt = Date.now();
    const abortController = new AbortController();
    input.signal?.addEventListener('abort', () => abortController.abort(), {
      once: true,
    });
    const abortSignal = abortController.signal;
    const completed = new Map<
      ProductIntentComboGroup,
      ProductComboGroupResult
    >();
    let nextIndex = 0;
    let budgetExpired = false;

    const runNext = async (): Promise<void> => {
      while (nextIndex < searchGroups.length && !budgetExpired) {
        if (Date.now() - startedAt >= budgetMs - launchWindowMs(budgetMs)) {
          budgetExpired = true;
          abortController.abort();
          return;
        }

        const group = searchGroups[nextIndex++];
        const result = await this.searchGroup({
          group,
          query: input.query,
          constraints: input.constraints,
          retriever: input.retriever,
          perGroupTopK,
          signal: abortSignal,
        });
        completed.set(group, result);
      }
    };

    const workers = Promise.all(
      Array.from({ length: concurrency }, () => runNext()),
    );
    let budgetTimer: ReturnType<typeof setTimeout> | undefined;
    const budget = new Promise<void>((resolve) => {
      budgetTimer = setTimeout(() => {
        budgetExpired = true;
        abortController.abort();
        resolve();
      }, budgetMs);
    });

    await Promise.race([workers, budget]);
    if (budgetTimer) clearTimeout(budgetTimer);

    const groups = searchGroups
      .map((group) => completed.get(group))
      .filter((group): group is ProductComboGroupResult => Boolean(group));
    const coveredGroups = groups
      .filter((group) => group.results.length > 0)
      .map((group) => group.id);
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

  private async searchGroup(input: {
    group: ProductIntentComboGroup;
    query: string;
    constraints?: ProductRetrievalConstraints;
    retriever: Pick<ProductRetriever, 'search'>;
    perGroupTopK: number;
    signal?: AbortSignal;
  }): Promise<ProductComboGroupResult> {
    const query = buildGroupQuery(input.query, input.group);
    const constraints = mergeRetrievalConstraints(
      softGlobalConstraints(input.constraints),
      {
        categoryHints: uniqueConstraintStrings(groupCategoryHints(input.group)),
        inStockOnly: input.constraints?.inStockOnly ?? true,
      },
    );
    const searchOptions: ComboRetrieverSearchOptions = {
      topK: input.perGroupTopK,
      constraints,
      pipeline: 'phase-09.2-baseline',
      signal: input.signal,
    };
    const result: ProductRetrievalResult = await input.retriever.search(
      query,
      searchOptions,
    );

    return {
      id: input.group,
      label: labelForGroup(input.group),
      query,
      results: result.results.slice(0, input.perGroupTopK),
    };
  }
}

const DEFAULT_COMBO_BUDGET_MS = 28_000;
const DEFAULT_COMBO_CONCURRENCY = 3;
const DEFAULT_MAX_COMBO_GROUPS = 6;
const MIN_GROUP_LAUNCH_WINDOW_MS = 2_000;
const CORE_LIVESTREAM_GROUPS: ProductIntentComboGroup[] = [
  'desktop_pc',
  'webcam',
  'microphone',
  'lighting',
  'headset',
  'monitor',
  'desk',
  'chair',
];
const COMBO_GROUP_CATEGORY_HINTS: Record<ProductIntentComboGroup, string[]> = {
  laptop: ['laptop', 'notebook', 'may tinh xach tay'],
  desktop_pc: ['desktop_pc', 'desktop pc', 'may tinh ban', 'may tinh de ban'],
  monitor: ['monitor', 'man hinh', 'man hinh may tinh'],
  keyboard: ['keyboard', 'ban phim', 'ban phim co'],
  mouse: ['mouse', 'chuot', 'chuot gaming'],
  webcam: ['webcam', 'camera', 'camera hoi nghi'],
  'usb-c-hub': ['usb-c hub', 'usb c hub', 'hub chuyen doi', 'cong chuyen'],
  headset: ['headset', 'tai nghe', 'tai nghe gaming'],
  microphone: ['microphone', 'micro', 'micro thu am'],
  lighting: ['lighting', 'den led', 'den livestream'],
  storage: ['storage', 'ssd', 'o cung', 'o cung di dong'],
  chair: ['chair', 'ghe', 'ghe gaming', 'ghe cong thai hoc'],
  desk: ['desk', 'ban gaming', 'ban lam viec', 'ban-ghe-gaming'],
  accessory: ['accessory', 'phu kien', 'phu kien may tinh'],
  pc: ['desktop_pc', 'desktop pc', 'may tinh ban', 'may tinh de ban'],
};

function clampPerGroupTopK(value: number | undefined): number {
  const normalized = Math.floor(value ?? 3);
  return Math.min(3, Math.max(1, Number.isFinite(normalized) ? normalized : 3));
}

function clampConcurrency(
  value: number | undefined,
  groupCount: number,
): number {
  if (groupCount <= 0) return 0;
  const normalized = Math.floor(value ?? DEFAULT_COMBO_CONCURRENCY);
  return Math.min(
    groupCount,
    Math.max(1, Number.isFinite(normalized) ? normalized : 1),
  );
}

function clampBudgetMs(value: number | undefined): number {
  const normalized = Math.floor(value ?? DEFAULT_COMBO_BUDGET_MS);
  return Math.max(
    1_000,
    Number.isFinite(normalized) ? normalized : DEFAULT_COMBO_BUDGET_MS,
  );
}

function clampGroupLimit(
  value: number | undefined,
  groupCount: number,
): number {
  const normalized = Math.floor(value ?? DEFAULT_MAX_COMBO_GROUPS);
  return Math.min(
    groupCount,
    Math.max(0, Number.isFinite(normalized) ? normalized : groupCount),
  );
}

function launchWindowMs(budgetMs: number): number {
  return Math.min(
    MIN_GROUP_LAUNCH_WINDOW_MS,
    Math.max(1, Math.floor(budgetMs / 3)),
  );
}
function prioritizeComboGroups(
  query: string,
  groups: ProductIntentComboGroup[],
  requestedGroups: ProductIntentComboGroup[] = explicitRequestedComboGroups(
    query,
  ),
): ProductIntentComboGroup[] {
  const requestedInInput = requestedGroups.filter((group) =>
    groups.includes(group),
  );
  if (!isLivestreamSetupQuery(query)) {
    return uniqueGroups([...requestedInInput, ...groups]);
  }

  return uniqueGroups([
    ...requestedInInput,
    ...CORE_LIVESTREAM_GROUPS.filter((group) => groups.includes(group)),
    ...groups,
  ]);
}

function isLivestreamSetupQuery(query: string): boolean {
  const normalized = normalizeComboText(query);
  return /\b(livestream|streaming|streamer|goc livestream)\b/.test(normalized);
}

function capProtectedSearchGroups(
  expectedGroups: ProductIntentComboGroup[],
  requestedGroups: ProductIntentComboGroup[],
  groupLimit: number,
): ProductIntentComboGroup[] {
  if (groupLimit <= 0) return [];
  const protectedGroups = expectedGroups.filter((group) =>
    requestedGroups.includes(group),
  );
  const optionalGroups = expectedGroups.filter(
    (group) => !requestedGroups.includes(group),
  );
  return uniqueGroups([...protectedGroups, ...optionalGroups]).slice(
    0,
    groupLimit,
  );
}

function explicitRequestedComboGroups(
  query: string,
): ProductIntentComboGroup[] {
  const normalized = normalizeComboText(query);
  const groups: ProductIntentComboGroup[] = [];
  if (/\b(laptop|notebook|may tinh xach tay)\b/.test(normalized)) {
    groups.push('laptop');
  }
  if (/\b(pc|desktop|may bo|may tinh de ban|may tinh ban)\b/.test(normalized)) {
    groups.push('desktop_pc');
  }
  if (/\b(ban|ban ghe|desk|ban gaming|ban lam viec)\b/.test(normalized)) {
    groups.push('desk');
  }
  if (/\b(ghe|chair|ghe gaming|ghe cong thai hoc)\b/.test(normalized)) {
    groups.push('chair');
  }
  if (/\b(micro|mic|microphone|thu am)\b/.test(normalized)) {
    groups.push('microphone');
  }
  if (/\b(webcam|camera)\b/.test(normalized)) groups.push('webcam');
  if (/\b(den|lighting|led)\b/.test(normalized)) groups.push('lighting');
  if (/\b(man hinh|monitor)\b/.test(normalized)) groups.push('monitor');
  if (/\b(ban phim|keyboard)\b/.test(normalized)) groups.push('keyboard');
  if (/\b(tai nghe|headset|headphone|earphone|earbuds)\b/.test(normalized)) {
    groups.push('headset');
  }
  if (/\b(chuot|mouse)\b/.test(normalized)) groups.push('mouse');
  return uniqueGroups(groups);
}

function normalizeComboText(query: string): string {
  return query
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase();
}

function buildGroupQuery(
  query: string,
  group: ProductIntentComboGroup,
): string {
  return `${query} ${group}`.replace(/\s+/g, ' ').trim();
}

function groupCategoryHints(group: ProductIntentComboGroup): string[] {
  return COMBO_GROUP_CATEGORY_HINTS[group] ?? [group];
}

function labelForGroup(group: ProductIntentComboGroup): string {
  if (group === 'desktop_pc') return 'Desktop PC';
  if (group === 'desk') return 'Desk';
  return group
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function uniqueGroups(
  groups: ProductIntentComboGroup[],
): ProductIntentComboGroup[] {
  return Array.from(new Set(groups.filter(Boolean)));
}

function uniqueConstraintStrings(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

function softGlobalConstraints(
  constraints?: ProductRetrievalConstraints,
): ProductRetrievalConstraints {
  if (!constraints) return {};
  const {
    category,
    categoryPath,
    categoryHints,
    requiredSpecs,
    ...softConstraints
  } = constraints;
  void category;
  void categoryPath;
  void categoryHints;
  void requiredSpecs;
  return softConstraints;
}
