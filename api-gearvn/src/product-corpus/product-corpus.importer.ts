import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Category } from '../category/category.schema';
import { Product } from '../product/product.schema';
import {
  NormalizedProductInput,
  NormalizedProductResult,
  ProductCorpusImportReport,
} from './product-corpus.types';

type ImportCandidate = NormalizedProductInput | NormalizedProductResult;

type ImportOptions = {
  dryRun?: boolean;
  sourceFile?: string;
  batchSize?: number;
};

type ProductModelLike = Pick<
  Model<Product>,
  'countDocuments' | 'create' | 'findOne' | 'find' | 'bulkWrite'
> & {
  docs?: any[];
};

type CategoryModelLike = Pick<
  Model<Category>,
  'countDocuments' | 'create' | 'findOne' | 'find' | 'bulkWrite'
> & {
  docs?: any[];
};

type ProductMatchResult =
  | {
      product: any;
      matchedBy: 'sku' | 'url_key' | 'normalized_name';
      conflict: false;
    }
  | { product: any; matchedBy: 'normalized_name'; conflict: true }
  | null;

type ImportState = {
  categoriesByName: Map<string, any>;
  productsBySku: Map<string, any>;
  productsByUrlKey: Map<string, any>;
  productsByNormalizedName: Map<string, any>;
  productsForDuplicateCheck: any[];
  categoryBulkOps: any[];
  productBulkOps: any[];
  queuedCategoryKeys: Set<string>;
};

@Injectable()
export class ProductCorpusImporter {
  constructor(
    @InjectModel(Product.name) private readonly productModel: ProductModelLike,
    @InjectModel(Category.name)
    private readonly categoryModel: CategoryModelLike,
  ) {}

  async importNormalizedProducts(
    inputs: ImportCandidate[],
    options: ImportOptions = {},
  ): Promise<ProductCorpusImportReport> {
    const preCounts = await this.readCounts();
    const importState = await this.loadImportState();
    const report: ProductCorpusImportReport = {
      sourceFile: options.sourceFile,
      dryRun: options.dryRun === true,
      totalRows: inputs.length,
      processed: 0,
      created: 0,
      updated: 0,
      skipped: [],
      errors: [],
      preCounts,
      postCounts: preCounts,
      duplicateCheck: { passed: true, conflicts: 0, groups: [] },
    };

    for (const [row, input] of inputs.entries()) {
      if ('ok' in input) {
        if (!input.ok) {
          report.skipped.push({
            row,
            sourceKey: input.sourceKey,
            reason: input.reason,
          });
          continue;
        }
      }

      const normalized = 'ok' in input ? input.value : input;

      try {
        report.processed += 1;
        const category = await this.upsertCategory(
          normalized,
          options,
          importState,
        );
        const match = await this.findProductMatch(normalized, importState);
        if (match?.conflict) {
          report.skipped.push({
            row,
            sourceKey: normalized.sourceKey,
            reason: 'duplicate_conflict',
          });
          continue;
        }

        const result = await this.upsertProduct(
          normalized,
          category,
          match?.product,
          options,
          importState,
        );
        if (result === 'created') report.created += 1;
        if (result === 'updated') report.updated += 1;
      } catch (error) {
        report.errors.push({
          row,
          sourceKey: normalized.sourceKey,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (!options.dryRun) await this.flushBulkWrites(importState, options);
    report.postCounts = options.dryRun ? preCounts : await this.readCounts();
    report.duplicateCheck = await this.checkDuplicateState(importState);
    return report;
  }

  async upsertCategory(
    input: NormalizedProductInput,
    options: ImportOptions = {},
    importState?: ImportState,
  ): Promise<{ name: string; label: string }> {
    const categoryKey = input.category;
    const category = importState
      ? importState.categoriesByName.get(categoryKey)
      : await execMaybe(
          this.categoryModel.findOne({
            $or: [
              { name: input.category },
              { 'sourceMetadata.normalizedName': input.category },
            ],
          }),
        );

    const sourceMetadata = {
      source: 'product-corpus-import',
      normalizedName: input.category,
      crawlPaths: input.categoryPath,
    };

    if (!category) {
      const createdCategory = {
        name: input.category,
        label: input.categoryLabel,
        fields: [],
        isPublished: true,
        publishedAt: new Date(),
        isArchived: false,
        sourceMetadata,
      };
      if (!options.dryRun && !usesMemoryCollection(this.categoryModel)) {
        queueCategoryInsert(importState, input.category, createdCategory);
      } else if (!options.dryRun) {
        await this.categoryModel.create(createdCategory);
      }
      importState?.categoriesByName.set(input.category, createdCategory);
      importState?.categoriesByName.set(
        sourceMetadata.normalizedName,
        createdCategory,
      );
      return { name: input.category, label: input.categoryLabel };
    }

    if (!options.dryRun) {
      const update = {
        name: category.name ?? input.category,
        label: category.label ?? input.categoryLabel,
        isPublished: true,
        isArchived: false,
        sourceMetadata,
      };
      Object.assign(category, update);
      if (usesMemoryCollection(this.categoryModel)) {
        await saveMaybe(category);
      } else {
        queueCategoryUpdate(importState, input.category, category, update);
      }
    }
    importState?.categoriesByName.set(
      category.name ?? input.category,
      category,
    );
    importState?.categoriesByName.set(sourceMetadata.normalizedName, category);

    return {
      name: category.name ?? input.category,
      label: category.label ?? input.categoryLabel,
    };
  }

  async findProductMatch(
    input: NormalizedProductInput,
    importState?: ImportState,
  ): Promise<ProductMatchResult> {
    const state = importState ?? (await this.loadImportState());
    const sourceSku = input.searchMetadata.sourceSku;
    if (sourceSku) {
      const product = state.productsBySku.get(sourceSku);
      if (product) return { product, matchedBy: 'sku', conflict: false };
    }

    const sourceUrlKey = input.searchMetadata.sourceUrlKey;
    if (sourceUrlKey) {
      const product = state.productsByUrlKey.get(sourceUrlKey);
      if (product) return { product, matchedBy: 'url_key', conflict: false };
    }

    const normalizedName = input.searchMetadata.normalizedName;
    if (!normalizedName) return null;

    const product = state.productsByNormalizedName.get(normalizedName);
    if (!product) return null;

    return {
      product,
      matchedBy: 'normalized_name',
      conflict: hasNameFallbackConflict(product, input),
    };
  }

  async upsertProduct(
    input: NormalizedProductInput,
    category: { name: string },
    existing?: any,
    options: ImportOptions = {},
    importState?: ImportState,
  ): Promise<'created' | 'updated'> {
    const payload = buildProductPayload(input, category.name);

    if (!existing) {
      const createdProduct = { ...payload };
      if (!options.dryRun && !usesMemoryCollection(this.productModel)) {
        importState?.productBulkOps.push({
          insertOne: { document: createdProduct },
        });
      } else if (!options.dryRun) {
        await this.productModel.create(payload);
      }
      importState && indexProduct(importState, createdProduct);
      return 'created';
    }

    Object.assign(existing, payload);
    if (!options.dryRun) {
      if (usesMemoryCollection(this.productModel)) {
        await saveMaybe(existing);
      } else if (existing._id) {
        importState?.productBulkOps.push({
          updateOne: {
            filter: { _id: existing._id },
            update: { $set: payload },
          },
        });
      }
    }
    importState && indexProduct(importState, existing);
    return 'updated';
  }

  async checkDuplicateState(
    importState?: ImportState,
  ): Promise<ProductCorpusImportReport['duplicateCheck']> {
    const products = importState
      ? importState.productsForDuplicateCheck
      : await this.loadProductsForIndex();

    const counts = new Map<string, number>();
    for (const doc of products) {
      const metadata = doc.searchMetadata ?? {};
      for (const key of [
        metadata.sourceSku && `sku:${metadata.sourceSku}`,
        metadata.sourceUrlKey && `url_key:${metadata.sourceUrlKey}`,
        metadata.normalizedName && `normalized_name:${metadata.normalizedName}`,
      ]) {
        if (!key) continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    const groups = Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, count]) => ({ key, count }));

    return {
      passed: groups.length === 0,
      conflicts: groups.length,
      groups,
    };
  }

  private async loadImportState(): Promise<ImportState> {
    const [products, categories] = await Promise.all([
      this.loadProductsForIndex(),
      this.loadCategoriesForIndex(),
    ]);
    const state: ImportState = {
      categoriesByName: new Map(),
      productsBySku: new Map(),
      productsByUrlKey: new Map(),
      productsByNormalizedName: new Map(),
      productsForDuplicateCheck: [],
      categoryBulkOps: [],
      productBulkOps: [],
      queuedCategoryKeys: new Set(),
    };

    for (const category of categories) {
      const metadata = category.sourceMetadata ?? {};
      if (category.name) state.categoriesByName.set(category.name, category);
      if (metadata.normalizedName) {
        state.categoriesByName.set(metadata.normalizedName, category);
      }
    }
    for (const product of products) indexProduct(state, product);
    return state;
  }

  private async loadProductsForIndex(): Promise<any[]> {
    if (Array.isArray(this.productModel.docs)) return this.productModel.docs;
    return execMaybe(
      this.productModel
        .find(
          {},
          {
            category: 1,
            price: 1,
            attributes: 1,
            searchMetadata: 1,
          },
        )
        .exec(),
    );
  }

  private async loadCategoriesForIndex(): Promise<any[]> {
    if (Array.isArray(this.categoryModel.docs)) return this.categoryModel.docs;
    return execMaybe(
      this.categoryModel
        .find(
          {},
          {
            name: 1,
            label: 1,
            sourceMetadata: 1,
          },
        )
        .exec(),
    );
  }

  private async flushBulkWrites(
    importState: ImportState,
    options: ImportOptions = {},
  ): Promise<void> {
    await flushBulkOps(this.categoryModel, importState.categoryBulkOps, 100);
    await flushBulkOps(
      this.productModel,
      importState.productBulkOps,
      normalizeBatchSize(options.batchSize, 250),
    );
  }

  private async readCounts(): Promise<{
    products: number;
    categories: number;
  }> {
    const [products, categories] = await Promise.all([
      this.productModel.countDocuments({}),
      this.categoryModel.countDocuments({}),
    ]);
    return { products, categories };
  }
}

function indexProduct(state: ImportState, product: any): void {
  const metadata = product.searchMetadata ?? {};
  if (!state.productsForDuplicateCheck.includes(product)) {
    state.productsForDuplicateCheck.push(product);
  }
  if (metadata.sourceSku) state.productsBySku.set(metadata.sourceSku, product);
  if (metadata.sourceUrlKey)
    state.productsByUrlKey.set(metadata.sourceUrlKey, product);
  if (metadata.normalizedName) {
    state.productsByNormalizedName.set(metadata.normalizedName, product);
  }
}

function queueCategoryInsert(
  state: ImportState | undefined,
  categoryKey: string,
  document: Record<string, unknown>,
): void {
  if (!state || state.queuedCategoryKeys.has(categoryKey)) return;
  state.queuedCategoryKeys.add(categoryKey);
  state.categoryBulkOps.push({ insertOne: { document } });
}

function queueCategoryUpdate(
  state: ImportState | undefined,
  categoryKey: string,
  category: any,
  update: Record<string, unknown>,
): void {
  if (!state || state.queuedCategoryKeys.has(categoryKey)) return;
  state.queuedCategoryKeys.add(categoryKey);
  const filter = category._id
    ? { _id: category._id }
    : {
        $or: [
          { name: category.name ?? categoryKey },
          { 'sourceMetadata.normalizedName': categoryKey },
        ],
      };
  state.categoryBulkOps.push({
    updateOne: { filter, update: { $set: update } },
  });
}

function normalizeBatchSize(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;
}

async function flushBulkOps(
  model: {
    bulkWrite: (ops: any[], options: { ordered: boolean }) => Promise<unknown>;
  },
  ops: any[],
  chunkSize: number,
): Promise<void> {
  for (let index = 0; index < ops.length; index += chunkSize) {
    await model.bulkWrite(ops.slice(index, index + chunkSize), {
      ordered: false,
    });
  }
}

function usesMemoryCollection(model: { docs?: any[] }): boolean {
  return Array.isArray(model.docs);
}

function buildProductPayload(input: NormalizedProductInput, category: string) {
  return {
    name: input.name,
    slug: input.slug,
    category,
    price: input.price,
    discountPrice: input.discountPrice,
    discountPercent: input.discountPercent,
    description: input.description,
    images: input.images,
    attributes: input.attributes,
    stock: input.stock,
    isPublished: true,
    publishedAt: input.publishedAt,
    isArchived: false,
    searchMetadata: input.searchMetadata,
  };
}

function hasNameFallbackConflict(
  product: any,
  input: NormalizedProductInput,
): boolean {
  if (product.category && product.category !== input.category) return true;
  if (typeof product.price === 'number') {
    const drift = Math.abs(product.price - input.price) / input.price;
    if (drift > 0.05) return true;
  }

  const existingAttributes = product.attributes ?? {};
  const importantKeys = [
    'CPU',
    'GPU',
    'RAM',
    'Chipset',
    'Dung lượng RAM',
    'Bộ nhớ trong',
  ];
  return importantKeys.some((key) => {
    const existing =
      existingAttributes instanceof Map
        ? existingAttributes.get(key)
        : existingAttributes[key];
    const incoming = input.attributes[key];
    return existing && incoming && existing !== incoming;
  });
}

async function execMaybe<T>(
  queryOrValue: T | { exec: () => Promise<T> },
): Promise<T> {
  if (
    queryOrValue &&
    typeof queryOrValue === 'object' &&
    'exec' in queryOrValue &&
    typeof queryOrValue.exec === 'function'
  ) {
    return queryOrValue.exec();
  }
  return queryOrValue as T;
}

async function saveMaybe(document: any): Promise<void> {
  if (document && typeof document.save === 'function') {
    await document.save();
  }
}
