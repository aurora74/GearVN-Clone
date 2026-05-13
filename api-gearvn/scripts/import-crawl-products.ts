import { argv } from 'node:process';
import mongoose from 'mongoose';

import { Category, CategorySchema } from '../src/category/category.schema';
import { Product, ProductSchema } from '../src/product/product.schema';
import {
  normalizeCrawlProduct,
  readCrawlJson,
  writeJsonReport,
} from '../src/product-corpus/product-corpus.normalizer';
import { ProductCorpusImporter } from '../src/product-corpus/product-corpus.importer';
import { loadLocalEnv, requireEnvPresence } from './script-env';

type ImportArgs = {
  source: string;
  limit?: number;
  batchSize: number;
  defaultStock?: number;
  dryRun: boolean;
  report?: string;
};

function parseArgs(rawArgs: string[]): ImportArgs {
  return rawArgs.reduce<ImportArgs>(
    (parsed, arg) => {
      if (arg.startsWith('--source=')) parsed.source = arg.slice('--source='.length);
      if (arg.startsWith('--limit=')) {
        const limit = Number(arg.slice('--limit='.length));
        if (Number.isFinite(limit) && limit > 0) parsed.limit = Math.floor(limit);
      }
      if (arg.startsWith('--batchSize=')) {
        const batchSize = Number(arg.slice('--batchSize='.length));
        if (Number.isFinite(batchSize) && batchSize > 0) {
          parsed.batchSize = Math.floor(batchSize);
        }
      }
      if (arg.startsWith('--defaultStock=')) {
        const defaultStock = Number(arg.slice('--defaultStock='.length));
        if (Number.isFinite(defaultStock) && defaultStock >= 0) {
          parsed.defaultStock = Math.floor(defaultStock);
        }
      }
      if (arg === '--dry-run') parsed.dryRun = true;
      if (arg.startsWith('--report=')) parsed.report = arg.slice('--report='.length);
      return parsed;
    },
    {
      source: '../data/products_crawl.json',
      batchSize: 100,
      dryRun: false,
    },
  );
}

async function main(): Promise<void> {
  loadLocalEnv();
  const envPresence = requireEnvPresence(['MONGO_URI']);
  if (!envPresence.MONGO_URI.present) {
    console.error(
      JSON.stringify({
        error: 'missing_required_env',
        required: envPresence,
      }),
    );
    process.exitCode = 1;
    return;
  }

  const args = parseArgs(argv.slice(2));
  const rows = await readCrawlJson(args.source);
  const selectedRows = args.limit ? rows.slice(0, args.limit) : rows;
  const normalized = selectedRows.map((row) =>
    normalizeCrawlProduct(row, { defaultStock: args.defaultStock }),
  );

  await mongoose.connect(process.env.MONGO_URI as string);
  try {
    const productModel = mongoose.model(Product.name, ProductSchema);
    const categoryModel = mongoose.model(Category.name, CategorySchema);
    const importer = new ProductCorpusImporter(productModel as any, categoryModel as any);
    const report = await importer.importNormalizedProducts(normalized, {
      dryRun: args.dryRun,
      sourceFile: args.source,
      batchSize: args.batchSize,
    });

    const output = {
      ...report,
      batchSize: args.batchSize,
      env: envPresence,
    };

    if (args.report) {
      await writeJsonReport(args.report, output);
    }
    console.log(JSON.stringify(output, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      error: 'import_crawl_products_failed',
      message: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exitCode = 1;
});
