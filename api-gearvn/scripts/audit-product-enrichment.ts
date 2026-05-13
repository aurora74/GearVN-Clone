import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { argv } from 'node:process';
import mongoose from 'mongoose';

import { readAiRetrievalConfig } from '../src/ai/config/ai-retrieval.config';
import { OpenRouterBgeM3Client } from '../src/ai/embeddings/openrouter-bge-m3.client';
import {
  auditProductEnrichment,
  ProductEnrichmentAuditReport,
  ProductEnrichmentRecommendedUpdate,
} from '../src/ai/retrieval/product-enrichment.audit';
import { buildProductSearchDocument } from '../src/ai/retrieval/product-search-document.builder';
import { ProductSearchDocument } from '../src/ai/retrieval/product-retrieval.types';
import {
  ProductVectorPoint,
  QdrantProductsClient,
} from '../src/ai/vector/qdrant-products.client';
import { Product, ProductSchema } from '../src/product/product.schema';
import { loadLocalEnv, requireEnvPresence } from './script-env';

type AuditArgs = {
  limit?: number;
  report?: string;
  applyRefresh: boolean;
  refreshQdrant: boolean;
  dryRunRefresh: boolean;
};

type AuditCliReport = ProductEnrichmentAuditReport & {
  enrichmentAuditReport: true;
  limited: boolean;
  updatedProducts: number;
  qdrantRefreshAttempted: boolean;
  qdrantRefreshValidated: boolean;
  qdrantRefreshSkippedReason?: string;
};

const DEFAULT_REQUIRED_ENV = ['MONGO_URI'];
const QDRANT_REFRESH_REQUIRED_ENV = [
  'OPENROUTER_API_KEY',
  'QDRANT_URL',
  'QDRANT_API_KEY',
];
const REFRESH_BATCH_SIZE = 32;

function parseArgs(rawArgs: string[]): AuditArgs {
  return rawArgs.reduce<AuditArgs>(
    (parsed, arg) => {
      if (arg.startsWith('--limit=')) {
        const limit = Number(arg.slice('--limit='.length));
        if (Number.isFinite(limit) && limit > 0) parsed.limit = Math.floor(limit);
      }
      if (arg.startsWith('--report=')) {
        parsed.report = arg.slice('--report='.length).trim();
      }
      if (arg === '--apply-refresh') parsed.applyRefresh = true;
      if (arg === '--refresh-qdrant') parsed.refreshQdrant = true;
      if (arg === '--dry-run-refresh') parsed.dryRunRefresh = true;
      return parsed;
    },
    {
      applyRefresh: false,
      refreshQdrant: false,
      dryRunRefresh: false,
    },
  );
}

async function main(): Promise<void> {
  loadLocalEnv();
  const args = parseArgs(argv.slice(2));
  const defaultEnvPresence = requireEnvPresence(DEFAULT_REQUIRED_ENV);
  const missingDefaultEnv = missingEnvNames(defaultEnvPresence);

  if (missingDefaultEnv.length > 0) {
    printMissingEnv(missingDefaultEnv, defaultEnvPresence);
    process.exitCode = 1;
    return;
  }

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

    const audit = auditProductEnrichment(products);
    const report: AuditCliReport = {
      enrichmentAuditReport: true,
      ...audit,
      limited: Boolean(args.limit),
      updatedProducts: 0,
      qdrantRefreshAttempted: false,
      qdrantRefreshValidated: false,
    };

    if (!audit.refreshRequired) {
      report.qdrantRefreshSkippedReason = 'refresh_not_required';
    } else if (!args.applyRefresh) {
      report.qdrantRefreshSkippedReason = 'apply_refresh_flag_not_set';
    } else if (args.dryRunRefresh) {
      report.qdrantRefreshSkippedReason = 'dry_run_refresh';
    } else {
      report.updatedProducts = await applyRecommendedUpdates(
        productModel,
        audit.recommendedUpdates,
      );

      if (args.refreshQdrant) {
        const qdrantEnvPresence = requireEnvPresence(QDRANT_REFRESH_REQUIRED_ENV);
        const missingQdrantEnv = missingEnvNames(qdrantEnvPresence);
        if (missingQdrantEnv.length > 0) {
          printMissingEnv(missingQdrantEnv, qdrantEnvPresence);
          process.exitCode = 1;
          return;
        }

        report.qdrantRefreshAttempted = true;
        report.qdrantRefreshValidated = await refreshQdrantProducts(
          products,
          audit.recommendedUpdates,
        );
      } else {
        report.qdrantRefreshSkippedReason = 'refresh_qdrant_flag_not_set';
      }
    }

    console.log(JSON.stringify(report, null, 2));

    if (args.report) {
      writeReport(args.report, report);
    }
  } finally {
    await mongoose.disconnect();
  }
}

async function applyRecommendedUpdates(
  productModel: mongoose.Model<unknown>,
  recommendedUpdates: ProductEnrichmentRecommendedUpdate[],
): Promise<number> {
  if (recommendedUpdates.length === 0) return 0;

  const result = await productModel.bulkWrite(
    recommendedUpdates.map((update) => ({
      updateOne: {
        filter: { _id: update.productId },
        update: { $set: { searchMetadata: update.searchMetadata } },
      },
    })),
    { ordered: false },
  );

  return result.modifiedCount;
}

async function refreshQdrantProducts(
  products: Array<Record<string, unknown>>,
  recommendedUpdates: ProductEnrichmentRecommendedUpdate[],
): Promise<boolean> {
  const config = readAiRetrievalConfig({ requireSecrets: true });
  const embeddings = new OpenRouterBgeM3Client(config);
  const qdrant = new QdrantProductsClient({ config });
  const updatesByProductId = new Map(
    recommendedUpdates.map((update) => [update.productId, update.searchMetadata]),
  );
  const documents = products
    .filter((product) => updatesByProductId.has(String(product._id)))
    .map((product) =>
      buildProductSearchDocument({
        ...product,
        searchMetadata: updatesByProductId.get(String(product._id)),
      }),
    )
    .filter((document) => document.productId && document.searchText);

  for (let index = 0; index < documents.length; index += REFRESH_BATCH_SIZE) {
    await refreshQdrantBatch(
      documents.slice(index, index + REFRESH_BATCH_SIZE),
      embeddings,
      qdrant,
    );
  }

  return documents.length > 0;
}

async function refreshQdrantBatch(
  documents: ProductSearchDocument[],
  embeddings: OpenRouterBgeM3Client,
  qdrant: QdrantProductsClient,
): Promise<void> {
  if (documents.length === 0) return;

  const embeddingResult = await embeddings.embedDocuments(
    documents.map((document) => document.searchText),
    { batchSize: REFRESH_BATCH_SIZE },
  );
  const points: ProductVectorPoint[] = documents.map((document, index) => ({
    productId: document.productId,
    vector: embeddingResult.vectors[index],
    payload: document.payload,
  }));

  for (const point of points) {
    qdrant.validatePayload(point.payload);
  }

  await qdrant.ensureCollection(embeddingResult.vectorSize);
  await qdrant.upsertProducts(points);
}

function missingEnvNames(
  envPresence: ReturnType<typeof requireEnvPresence>,
): string[] {
  return Object.entries(envPresence)
    .filter(([, value]) => !value.present)
    .map(([name]) => name);
}

function printMissingEnv(
  missingEnv: string[],
  required: ReturnType<typeof requireEnvPresence>,
): void {
  console.error(
    JSON.stringify(
      {
        error: 'missing_required_env',
        missingEnv,
        required,
        secretKeysLogged: false,
      },
      null,
      2,
    ),
  );
}

function writeReport(reportPath: string, report: AuditCliReport): void {
  const absolutePath = resolve(process.cwd(), reportPath);
  const directory = dirname(absolutePath);
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }
  writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      error: 'audit_product_enrichment_failed',
      message: error instanceof Error ? error.message : String(error),
      secretKeysLogged: false,
    }),
  );
  process.exitCode = 1;
});
