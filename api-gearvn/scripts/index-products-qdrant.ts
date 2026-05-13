import { argv } from 'node:process';
import mongoose from 'mongoose';

import { Product, ProductSchema } from '../src/product/product.schema';
import { OpenRouterBgeM3Client } from '../src/ai/embeddings/openrouter-bge-m3.client';
import { readAiRetrievalConfig } from '../src/ai/config/ai-retrieval.config';
import { buildProductSearchDocument } from '../src/ai/retrieval/product-search-document.builder';
import { ProductSearchDocument } from '../src/ai/retrieval/product-retrieval.types';
import {
  ProductVectorPoint,
  QdrantProductsClient,
} from '../src/ai/vector/qdrant-products.client';
import { loadLocalEnv, requireEnvPresence } from './script-env';

type IndexArgs = {
  limit?: number;
  batchSize: number;
  dryRun: boolean;
  rebuild: boolean;
};

type MissingOrOrphanCheck = {
  checked: boolean;
  expectedIndexed: number;
  qdrantCount: number | null;
  difference: number | null;
  missing: string[];
  orphaned: string[];
};

type IndexReport = {
  indexReport: true;
  collection: string;
  embeddingModel: string;
  vectorSize: number;
  matchedProducts: number;
  indexed: number;
  skipped: Array<{ productId: string; reason: string }>;
  failed: Array<{ productId: string; message: string }>;
  batches: number;
  samplePayloads: unknown[];
  qdrantCount: number | null;
  missingOrOrphanCheck: MissingOrOrphanCheck;
  dryRun: boolean;
  rebuild: boolean;
  limited: boolean;
  secretKeysLogged: false;
};

type IndexingState = {
  collectionReady: boolean;
  collectionRebuilt: boolean;
};

const REQUIRED_ENV = [
  'MONGO_URI',
  'OPENROUTER_API_KEY',
  'QDRANT_URL',
  'QDRANT_API_KEY',
];

function parseArgs(rawArgs: string[]): IndexArgs {
  return rawArgs.reduce<IndexArgs>(
    (parsed, arg) => {
      if (arg.startsWith('--limit=')) {
        const limit = Number(arg.slice('--limit='.length));
        if (Number.isFinite(limit) && limit > 0) {
          parsed.limit = Math.floor(limit);
        }
      }
      if (arg.startsWith('--batchSize=')) {
        const batchSize = Number(arg.slice('--batchSize='.length));
        if (Number.isFinite(batchSize) && batchSize > 0) {
          parsed.batchSize = Math.floor(batchSize);
        }
      }
      if (arg === '--dry-run') parsed.dryRun = true;
      if (arg === '--rebuild') parsed.rebuild = true;
      return parsed;
    },
    { batchSize: 32, dryRun: false, rebuild: false },
  );
}

async function main(): Promise<void> {
  loadLocalEnv();
  const envPresence = requireEnvPresence(REQUIRED_ENV);
  const missingEnv = Object.entries(envPresence)
    .filter(([, value]) => !value.present)
    .map(([name]) => name);

  if (missingEnv.length > 0) {
    console.error(
      JSON.stringify(
        {
          error: 'missing_required_env',
          missingEnv,
          required: envPresence,
          secretKeysLogged: false,
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
    return;
  }

  const args = parseArgs(argv.slice(2));
  const config = readAiRetrievalConfig({ requireSecrets: true });
  const productModel = mongoose.model(Product.name, ProductSchema);

  await mongoose.connect(process.env.MONGO_URI as string);
  try {
    const products = await productModel
      .find({
        isPublished: { $ne: false },
        isArchived: { $ne: true },
      })
      .sort({ _id: 1 })
      .limit(args.limit ?? 0)
      .lean()
      .exec();

    const documents = products
      .map((product) => buildProductSearchDocument(product))
      .filter((document) => document.productId && document.searchText);

    const embeddings = new OpenRouterBgeM3Client(config);
    const qdrant = new QdrantProductsClient({ config });
    const report = createEmptyReport({
      collection: config.qdrant.collection,
      embeddingModel: config.openRouter.embeddingModel,
      matchedProducts: documents.length,
      dryRun: args.dryRun,
      rebuild: args.rebuild,
      limited: Boolean(args.limit),
    });

    const indexingState: IndexingState = {
      collectionReady: false,
      collectionRebuilt: false,
    };

    for (let index = 0; index < documents.length; index += args.batchSize) {
      const batch = documents.slice(index, index + args.batchSize);
      await indexBatch(batch, {
        embeddings,
        qdrant,
        report,
        dryRun: args.dryRun,
        rebuild: args.rebuild,
        batchSize: args.batchSize,
        state: indexingState,
      });

      const processed = Math.min(index + batch.length, documents.length);
      if (shouldLogProgress(processed, documents.length, args.batchSize)) {
        console.error(
          JSON.stringify({
            indexProgress: true,
            processed,
            matchedProducts: documents.length,
            indexed: report.indexed,
            failed: report.failed.length,
            batches: report.batches,
            secretKeysLogged: false,
          }),
        );
      }
    }

    if (!args.dryRun) {
      report.qdrantCount = await qdrant.countProducts();
      report.missingOrOrphanCheck = compareProductIds(
        documents.map((document) => document.productId),
        await qdrant.listProductPayloadIds(),
        report.qdrantCount,
      );
    }

    if (!args.dryRun && shouldFailIndexReport(report)) {
      console.error(
        JSON.stringify({
          error: 'index_incomplete',
          failed: report.failed.length,
          missing: report.missingOrOrphanCheck.missing.length,
          orphaned: report.missingOrOrphanCheck.orphaned.length,
          secretKeysLogged: false,
        }),
      );
      process.exitCode = 1;
    }

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

async function indexBatch(
  documents: ProductSearchDocument[],
  options: {
    embeddings: OpenRouterBgeM3Client;
    qdrant: QdrantProductsClient;
    report: IndexReport;
    dryRun: boolean;
    rebuild: boolean;
    batchSize: number;
    state: IndexingState;
  },
): Promise<IndexingState> {
  if (documents.length === 0) return options.state;

  try {
    const embeddingResult = await options.embeddings.embedDocuments(
      documents.map((document) => document.searchText),
      { batchSize: options.batchSize },
    );
    options.report.batches += embeddingResult.batchCount;
    options.report.vectorSize ||= embeddingResult.vectorSize;

    const points: ProductVectorPoint[] = documents.map((document, index) => ({
      productId: document.productId,
      vector: embeddingResult.vectors[index],
      payload: document.payload,
    }));

    for (const point of points) {
      options.qdrant.validatePayload(point.payload);
    }

    if (options.report.samplePayloads.length < 3) {
      options.report.samplePayloads.push(
        ...points
          .slice(0, 3 - options.report.samplePayloads.length)
          .map((point) => point.payload),
      );
    }

    if (!options.dryRun) {
      if (options.rebuild && !options.state.collectionRebuilt) {
        await options.qdrant.recreateCollection(embeddingResult.vectorSize);
        options.state.collectionReady = true;
        options.state.collectionRebuilt = true;
      } else if (!options.state.collectionReady) {
        await options.qdrant.ensureCollection(embeddingResult.vectorSize);
        options.state.collectionReady = true;
      }
      await options.qdrant.upsertProducts(points);
    }

    options.report.indexed += points.length;
    return options.state;
  } catch (error) {
    if (documents.length > 1) {
      const midpoint = Math.ceil(documents.length / 2);
      await indexBatch(documents.slice(0, midpoint), options);
      return indexBatch(documents.slice(midpoint), options);
    }

    const document = documents[0];
    options.report.failed.push({
      productId: document.productId,
      message: error instanceof Error ? error.message : String(error),
    });
    return options.state;
  }
}

function createEmptyReport(input: {
  collection: string;
  embeddingModel: string;
  matchedProducts: number;
  dryRun: boolean;
  rebuild: boolean;
  limited: boolean;
}): IndexReport {
  return {
    indexReport: true,
    collection: input.collection,
    embeddingModel: input.embeddingModel,
    vectorSize: 0,
    matchedProducts: input.matchedProducts,
    indexed: 0,
    skipped: [],
    failed: [],
    batches: 0,
    samplePayloads: [],
    qdrantCount: null,
    missingOrOrphanCheck: {
      checked: false,
      expectedIndexed: 0,
      qdrantCount: null,
      difference: null,
      missing: [],
      orphaned: [],
    },
    dryRun: input.dryRun,
    rebuild: input.rebuild,
    limited: input.limited,
    secretKeysLogged: false,
  };
}

function compareProductIds(
  expectedIds: string[],
  qdrantIds: string[],
  qdrantCount: number | null,
): MissingOrOrphanCheck {
  const expected = new Set(expectedIds);
  const actual = new Set(qdrantIds);
  const missing = Array.from(expected)
    .filter((productId) => !actual.has(productId))
    .sort((left, right) => left.localeCompare(right));
  const orphaned = Array.from(actual)
    .filter((productId) => !expected.has(productId))
    .sort((left, right) => left.localeCompare(right));

  return {
    checked: true,
    expectedIndexed: expected.size,
    qdrantCount,
    difference: qdrantCount === null ? null : qdrantCount - expected.size,
    missing,
    orphaned,
  };
}

function shouldFailIndexReport(report: IndexReport): boolean {
  return (
    report.failed.length > 0 ||
    report.missingOrOrphanCheck.missing.length > 0 ||
    report.missingOrOrphanCheck.orphaned.length > 0
  );
}

function shouldLogProgress(
  processed: number,
  total: number,
  batchSize: number,
): boolean {
  if (processed >= total) return true;
  const progressInterval = Math.max(batchSize * 10, 250);
  return processed % progressInterval === 0;
}
main().catch((error) => {
  console.error(
    JSON.stringify({
      error: 'index_products_qdrant_failed',
      message: error instanceof Error ? error.message : String(error),
      secretKeysLogged: false,
    }),
  );
  process.exitCode = 1;
});
