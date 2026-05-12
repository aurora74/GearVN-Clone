import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { z } from 'zod';

import {
  NormalizeSkipReason,
  NormalizedProductInput,
  NormalizedProductResult,
  ProductCorpusProfileReport,
  ProductCorpusSourceProduct,
  ProductMatchKey,
} from './product-corpus.types';
import {
  incrementCounter,
  sortedCounter,
  summarizeSkippedReasons,
} from './product-corpus.report';

export const CRAWL_PRODUCTS_JSON = 'data/products_crawl.json';
export const CRAWL_PLACEHOLDER_IMAGE_URL =
  'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/i/p/iphone-17-pro-max_3_1_1_1_1_1_1.jpg';
export const DEFAULT_IMPORTED_STOCK = 10;

const sourceCategorySchema = z
  .object({
    id: z.number().optional(),
    name: z.string().optional(),
    uri: z.string().optional(),
  })
  .passthrough();

const sourceProductSchema = z
  .object({
    product_id: z.union([z.number(), z.string()]).optional(),
    name: z.string().optional(),
    sku: z.string().optional(),
    manufacturer: z.string().optional(),
    url_key: z.string().optional(),
    url: z.string().optional(),
    category_name: z.string().optional(),
    sub_category: z.string().optional(),
    query_category: z.string().optional(),
    price: z.union([z.number(), z.string()]).nullable().optional(),
    special_price: z.union([z.number(), z.string()]).nullable().optional(),
    display_price: z.union([z.number(), z.string()]).nullable().optional(),
    promotion_percent: z.union([z.number(), z.string()]).nullable().optional(),
    thumbnail: z.string().nullable().optional(),
    stock_available: z.boolean().nullable().optional(),
    categories: z.array(sourceCategorySchema).optional(),
    specifications: z.record(z.string(), z.unknown()).nullable().optional(),
    description: z.string().nullable().optional(),
  })
  .passthrough();

const crawlCorpusSchema = z
  .object({
    products: z.array(sourceProductSchema),
  })
  .passthrough();

type NormalizeOptions = {
  defaultStock?: number;
  now?: Date;
};

type ProfileOptions = {
  sourceFile?: string;
};

export async function readCrawlJson(
  filePath = `../${CRAWL_PRODUCTS_JSON}`,
): Promise<ProductCorpusSourceProduct[]> {
  const absolutePath = resolve(process.cwd(), filePath);
  const parsed = JSON.parse(await readFile(absolutePath, 'utf8'));
  return crawlCorpusSchema.parse(parsed).products;
}

export function profileCrawlProducts(
  source: ProductCorpusSourceProduct[],
  options: ProfileOptions = {},
): ProductCorpusProfileReport {
  const skipped: Array<{ reason: string }> = [];
  const priceAnomalies: ProductCorpusProfileReport['priceAnomalies'] = [];
  const categoryDistribution: Record<string, number> = {};
  const specCoverage: Record<string, number> = {};
  const slugCounts: Record<string, number> = {};
  let validRows = 0;
  let inStock = 0;
  let outOfStock = 0;

  source.forEach((row, index) => {
    const normalized = normalizeCrawlProduct(row);
    if (!normalized.ok) {
      skipped.push({ reason: normalized.reason });
      if (isPriceReason(normalized.reason)) {
        priceAnomalies.push({
          row: index,
          sourceKey: normalized.sourceKey,
          reason: normalized.reason,
        });
      }
      return;
    }

    validRows += 1;
    incrementCounter(categoryDistribution, normalized.value.categoryLabel);
    incrementCounter(slugCounts, normalized.value.slug);
    if (normalized.value.stock > 0) inStock += 1;
    else outOfStock += 1;

    for (const key of Object.keys(normalized.value.attributes)) {
      incrementCounter(specCoverage, key);
    }
  });

  const slugDuplicateGroups = Object.entries(slugCounts)
    .filter(([, count]) => count > 1)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, count]) => ({ key, count }));

  return {
    sourceFile: options.sourceFile ?? CRAWL_PRODUCTS_JSON,
    totalRows: source.length,
    validRows,
    invalidRows: source.length - validRows,
    duplicateCandidates: slugDuplicateGroups.reduce(
      (total, group) => total + group.count - 1,
      0,
    ),
    slugDuplicateGroups,
    categoryDistribution: sortedCounter(categoryDistribution),
    priceAnomalies,
    stockDistribution: { inStock, outOfStock },
    specCoverage: sortedCounter(specCoverage),
    skippedReasons: sortedCounter(summarizeSkippedReasons(skipped)),
  };
}

export function normalizeCrawlProduct(
  row: ProductCorpusSourceProduct,
  options: NormalizeOptions = {},
): NormalizedProductResult {
  const parsed = sourceProductSchema.safeParse(row);
  const source = parsed.success ? parsed.data : row;
  const sourceKey =
    firstText(source.sku, source.url_key, source.product_id) ?? '';
  const name = cleanText(source.name);
  if (!name) return skip('invalid_name', sourceKey);

  const slug = slugify(source.url_key || name);
  if (!slug) return skip('invalid_slug', sourceKey || name);

  const categoryPath = buildCategoryPath(source);
  const categoryLabel = categoryPath[0] ?? cleanText(source.category_name);
  if (!categoryLabel) return skip('invalid_category', sourceKey || slug);

  const price = toPositiveNumber(source.price);
  const discountPrice = toPositiveNumber(
    source.special_price ?? source.display_price,
  );
  if (!price) return skip('invalid_price', sourceKey || slug);

  const effectiveDiscountPrice = discountPrice ?? price;
  if (effectiveDiscountPrice > price) {
    return skip('invalid_discount', sourceKey || slug);
  }

  if (!CRAWL_PLACEHOLDER_IMAGE_URL)
    return skip('missing_image', sourceKey || slug);

  const normalizedSpecs = normalizeSpecs(source.specifications);
  const searchMetadata = buildSearchMetadata({
    row: source,
    name,
    categoryPath,
    normalizedSpecs,
    description: cleanText(source.description),
  });

  const value: NormalizedProductInput = {
    sourceKey: sourceKey || slug,
    name,
    slug,
    category: slugify(categoryLabel),
    categoryLabel,
    categoryPath,
    price,
    discountPrice: effectiveDiscountPrice,
    discountPercent: computeDiscountPercent(price, effectiveDiscountPrice),
    description: cleanText(source.description),
    images: [CRAWL_PLACEHOLDER_IMAGE_URL],
    attributes: normalizedSpecs,
    stock:
      source.stock_available === false
        ? 0
        : (options.defaultStock ?? DEFAULT_IMPORTED_STOCK),
    isPublished: true,
    publishedAt: options.now ?? new Date(),
    isArchived: false,
    searchMetadata,
  };

  return { ok: true, value };
}

export function buildProductMatchKeys(
  input: NormalizedProductInput | NormalizedProductResult,
): ProductMatchKey[] {
  const normalized =
    'ok' in input ? (input.ok ? input.value : undefined) : input;
  if (!normalized) return [];

  return [
    normalized.searchMetadata.sourceSku
      ? { type: 'sku' as const, value: normalized.searchMetadata.sourceSku }
      : undefined,
    normalized.searchMetadata.sourceUrlKey
      ? {
          type: 'url_key' as const,
          value: normalized.searchMetadata.sourceUrlKey,
        }
      : undefined,
    normalized.searchMetadata.normalizedName
      ? {
          type: 'normalized_name' as const,
          value: normalized.searchMetadata.normalizedName,
        }
      : undefined,
  ].filter((key): key is ProductMatchKey => Boolean(key?.value));
}

export function buildSpecsSummary(
  normalizedSpecs: Record<string, unknown>,
): string {
  return Object.entries(normalizedSpecs)
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, 16)
    .map(([key, value]) => `${key}: ${stringifySpecValue(value)}`)
    .filter((part) => !part.endsWith(': '))
    .join(' | ');
}

export function buildSearchMetadata(input: {
  row: ProductCorpusSourceProduct;
  name: string;
  categoryPath: string[];
  normalizedSpecs: Record<string, unknown>;
  description?: string;
}): NormalizedProductInput['searchMetadata'] {
  const specsSummary = buildSpecsSummary(input.normalizedSpecs);
  const manufacturer = cleanText(input.row.manufacturer);
  const semanticTags = uniqueStrings(
    [
      manufacturer,
      ...input.categoryPath,
      input.row.sku,
      input.row.url_key,
      ...Object.values(input.normalizedSpecs).flatMap((value) =>
        tokenizeSpecValue(value),
      ),
    ].map((tag) => cleanText(tag).toLowerCase()),
  );
  const useCases = inferUseCases(input.name, input.description, semanticTags);
  const targetUsers = inferTargetUsers(
    input.name,
    input.description,
    semanticTags,
  );

  return {
    sourceSku: cleanText(input.row.sku),
    sourceUrlKey: cleanText(input.row.url_key),
    sourceProductId: firstText(input.row.product_id),
    manufacturer,
    normalizedName: normalizeName(input.name),
    categoryPath: input.categoryPath,
    normalizedSpecs: input.normalizedSpecs,
    specsSummary,
    semanticTags,
    useCases,
    targetUsers,
    searchText: uniqueStrings([
      input.name,
      ...input.categoryPath,
      specsSummary,
      ...semanticTags,
      ...useCases,
      ...targetUsers,
      input.description,
    ]).join(' | '),
  };
}

export async function writeJsonReport(
  reportPath: string,
  report: unknown,
): Promise<void> {
  const absolutePath = resolve(process.cwd(), reportPath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function buildCategoryPath(source: ProductCorpusSourceProduct): string[] {
  const fromCategories =
    source.categories
      ?.map((category) => cleanText(category.name))
      .filter((name) => name && name.toLowerCase() !== 'root') ?? [];
  return uniqueStrings([
    ...fromCategories,
    cleanText(source.category_name),
    cleanText(source.sub_category),
    cleanText(source.query_category),
  ]);
}

function normalizeSpecs(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.entries(value).reduce<Record<string, unknown>>(
    (specs, [key, raw]) => {
      const cleanKey = cleanText(key);
      const cleanValue = typeof raw === 'string' ? cleanText(raw) : raw;
      if (
        cleanKey &&
        cleanValue !== undefined &&
        cleanValue !== null &&
        cleanValue !== ''
      ) {
        specs[cleanKey] = cleanValue;
      }
      return specs;
    },
    {},
  );
}

function computeDiscountPercent(price: number, discountPrice: number): number {
  if (discountPrice >= price) return 0;
  return Math.round(((price - discountPrice) / price) * 100);
}

function toPositiveNumber(value: unknown): number | undefined {
  const text =
    typeof value === 'number'
      ? String(value)
      : typeof value === 'string'
        ? value.trim()
        : '';
  const normalized = text
    .replace(/[^\d,.-]/g, '')
    .replace(/[.,](?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const numberValue = Number(normalized);
  return Number.isFinite(numberValue) && numberValue > 0
    ? Math.round(numberValue)
    : undefined;
}

function slugify(value: unknown): string {
  return normalizeName(String(value ?? ''))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function firstText(...values: unknown[]): string | undefined {
  for (const value of values) {
    const text = typeof value === 'number' ? String(value) : cleanText(value);
    if (text) return text;
  }
  return undefined;
}

function stringifySpecValue(value: unknown): string {
  if (Array.isArray(value))
    return value.map(cleanText).filter(Boolean).join(', ');
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  return cleanText(value);
}

function tokenizeSpecValue(value: unknown): string[] {
  const text = stringifySpecValue(value).toLowerCase();
  const matches = text.match(/[a-z0-9]+(?:\s?(?:gb|tb|mah|mp|hz|k))?/gi) ?? [];
  return uniqueStrings([
    text,
    ...matches.map((match) => match.trim().toLowerCase()),
  ]);
}

function inferUseCases(
  name: string,
  description = '',
  semanticTags: string[] = [],
): string[] {
  const haystack =
    `${name} ${description} ${semanticTags.join(' ')}`.toLowerCase();
  return uniqueStrings([
    /gaming|game|gt|ultra|snapdragon|rtx|geforce/.test(haystack)
      ? 'gaming'
      : '',
    /camera|chụp|quay|photography|mp/.test(haystack) ? 'photography' : '',
    /ai|npu|neural/.test(haystack) ? 'ai-assisted' : '',
    /office|văn phòng|work|học|student/.test(haystack) ? 'productivity' : '',
  ]);
}

function inferTargetUsers(
  name: string,
  description = '',
  semanticTags: string[] = [],
): string[] {
  const haystack =
    `${name} ${description} ${semanticTags.join(' ')}`.toLowerCase();
  return uniqueStrings([
    /pro|max|ultra|flagship|16 gb|1 tb|a19|snapdragon/.test(haystack)
      ? 'power-user'
      : '',
    /gaming|game|rtx|gt/.test(haystack) ? 'gamer' : '',
    /student|học sinh|sinh viên/.test(haystack) ? 'student' : '',
  ]);
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const text = cleanText(value);
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    result.push(text);
  }
  return result;
}

function isPriceReason(reason: NormalizeSkipReason): boolean {
  return reason === 'invalid_price' || reason === 'invalid_discount';
}

function skip(
  reason: NormalizeSkipReason,
  sourceKey: string,
): NormalizedProductResult {
  return { ok: false, reason, sourceKey };
}
