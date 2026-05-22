import { join, resolve } from 'node:path';
import { argv } from 'node:process';
import mongoose from 'mongoose';

import { readAiRetrievalConfig } from '../src/ai/config/ai-retrieval.config';
import { readDeepSeekRewriteConfig } from '../src/ai/config/deepseek-rewrite.config';
import { OpenRouterBgeM3Client } from '../src/ai/embeddings/openrouter-bge-m3.client';
import { DeepSeekQueryRewriteClient } from '../src/ai/retrieval/deepseek-query-rewrite.client';
import { ProductComboRetrievalService } from '../src/ai/retrieval/product-combo-retrieval.service';
import { ProductLexicalSearchService } from '../src/ai/retrieval/product-lexical-search.service';
import { ProductQueryRewriteService } from '../src/ai/retrieval/product-query-rewrite.service';
import { productRetrievalBenchmarkCases } from '../src/ai/retrieval/product-retrieval.benchmark-cases';
import {
  ProductRetrievalAblationReport,
  ProductRetrievalBenchmarkReport,
  ProductRetrievalComparisonReport,
  runProductRetrievalAblation,
  runProductRetrievalBenchmark,
  runProductRetrievalComparison,
} from '../src/ai/retrieval/product-retrieval.benchmark';
import {
  ProductRetrievalReportFormat,
  writeProductRetrievalAblationReports,
  writeProductRetrievalReports,
} from '../src/ai/retrieval/product-retrieval-report-export';
import { ProductRetriever } from '../src/ai/retrieval/product-retriever';
import {
  BenchmarkCase,
  ProductRetrievalPipelineMode,
  ProductSearchPayload,
} from '../src/ai/retrieval/product-retrieval.types';
import { QdrantProductsClient } from '../src/ai/vector/qdrant-products.client';
import { Product, ProductSchema } from '../src/product/product.schema';
import { loadLocalEnv, requireEnvPresence } from './script-env';

export type BenchmarkMode = 'baseline' | 'improved' | 'compare' | 'ablation';

export type BenchmarkArgs = {
  limit?: number;
  topK: number;
  queries?: BenchmarkCase['group'][];
  mode: BenchmarkMode;
  reportDir: string;
  formats: ProductRetrievalReportFormat[];
  rewriteTimeoutMs: number;
  allowDeterministicShortCircuit: boolean;
  loadLocalEnv: boolean;
};

type BenchmarkCliReport = ProductRetrievalBenchmarkReport & {
  benchmarkReport: true;
  mode: Exclude<BenchmarkMode, 'compare'>;
  pipelineVersion: ProductRetrievalPipelineMode;
  secretKeysLogged: false;
};

type ComparisonCliReport = ProductRetrievalComparisonReport & {
  reportFiles?: Awaited<ReturnType<typeof writeProductRetrievalReports>>;
};

type AblationCliReport = ProductRetrievalAblationReport & {
  reportFiles?: Awaited<ReturnType<typeof writeProductRetrievalAblationReports>>;
};

type CliMetadata = {
  timestamp: string;
  collection: string;
  embeddingModel: string;
  qdrantCount: number | null;
  selectedCases: number;
  rewriteTimeoutMs: number;
  allowDeterministicShortCircuit: boolean;
};

type CliReport = (BenchmarkCliReport | ComparisonCliReport | AblationCliReport) &
  CliMetadata;

const REQUIRED_ENV = [
  'OPENROUTER_API_KEY',
  'QDRANT_URL',
  'QDRANT_API_KEY',
  'DEEPSEEK_API_KEY',
];
const ABLATION_REQUIRED_ENV = [...REQUIRED_ENV, 'MONGO_URI'];
const QUERY_GROUPS: BenchmarkCase['group'][] = [
  'keyword',
  'need_based',
  'gift',
  'technical',
  'combo',
  'ambiguous',
];
const REPORT_FORMATS: ProductRetrievalReportFormat[] = ['json', 'csv', 'md'];
export const DEFAULT_BENCHMARK_REWRITE_TIMEOUT_MS = 10_000;
export const CHAPTER_4_FINAL_REPORT_DIR = join(
  'reports',
  'phase-10-retrieval',
  'chapter-4-final',
);

export function parseArgs(rawArgs: string[]): BenchmarkArgs {
  return rawArgs.reduce<BenchmarkArgs>(
    (parsed, arg) => {
      if (arg.startsWith('--limit=')) {
        const limit = Number(arg.slice('--limit='.length));
        if (Number.isFinite(limit) && limit > 0)
          parsed.limit = Math.floor(limit);
      }
      if (arg.startsWith('--topK=')) {
        const topK = Number(arg.slice('--topK='.length));
        if (Number.isFinite(topK) && topK > 0) parsed.topK = Math.floor(topK);
      }
      if (arg.startsWith('--rewriteTimeoutMs=')) {
        const rewriteTimeoutMs = Number(arg.slice('--rewriteTimeoutMs='.length));
        if (Number.isFinite(rewriteTimeoutMs) && rewriteTimeoutMs > 0) {
          parsed.rewriteTimeoutMs = Math.floor(rewriteTimeoutMs);
        }
      }
      if (
        arg === '--no-deterministic-short-circuit' ||
        arg === '--deterministicShortCircuit=false' ||
        arg === '--allowDeterministicShortCircuit=false'
      ) {
        parsed.allowDeterministicShortCircuit = false;
      }
      if (
        arg === '--deterministicShortCircuit=true' ||
        arg === '--allowDeterministicShortCircuit=true'
      ) {
        parsed.allowDeterministicShortCircuit = true;
      }
      if (arg === '--no-load-local-env') {
        parsed.loadLocalEnv = false;
      }
      if (arg.startsWith('--queries=')) {
        parsed.queries = arg
          .slice('--queries='.length)
          .split(',')
          .map((group) => group.trim())
          .filter((group): group is BenchmarkCase['group'] =>
            QUERY_GROUPS.includes(group as BenchmarkCase['group']),
          );
      }
      if (arg.startsWith('--mode=')) {
        const mode = arg.slice('--mode='.length).trim();
        if (isBenchmarkMode(mode)) parsed.mode = mode;
      }
      if (arg.startsWith('--reportDir=')) {
        const reportDir = arg.slice('--reportDir='.length).trim();
        if (reportDir) parsed.reportDir = reportDir;
      }
      if (arg.startsWith('--formats=')) {
        const formats = arg
          .slice('--formats='.length)
          .split(',')
          .map((format) => format.trim())
          .filter((format): format is ProductRetrievalReportFormat =>
            REPORT_FORMATS.includes(format as ProductRetrievalReportFormat),
          );
        if (formats.length > 0) parsed.formats = formats;
      }
      return parsed;
    },
    {
      topK: 10,
      mode: 'compare',
      reportDir: CHAPTER_4_FINAL_REPORT_DIR,
      formats: REPORT_FORMATS,
      rewriteTimeoutMs: DEFAULT_BENCHMARK_REWRITE_TIMEOUT_MS,
      allowDeterministicShortCircuit: true,
      loadLocalEnv: true,
    }
  );
}

async function main(): Promise<void> {
  const args = parseArgs(argv.slice(2));
  if (args.loadLocalEnv) {
    loadLocalEnv();
  }
  const envPresence = requireEnvPresence(requiredEnvForMode(args.mode));
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

  const config = readAiRetrievalConfig({ requireSecrets: true });
  const rewriteConfig =
    args.mode === 'baseline'
      ? undefined
      : readDeepSeekRewriteConfig({ requireSecrets: true });
  const embeddings = new OpenRouterBgeM3Client(config);
  const qdrant = new QdrantProductsClient({ config });
  const rewriteClient = new DeepSeekQueryRewriteClient(rewriteConfig);
  const rewriteService = new ProductQueryRewriteService(
    rewriteClient,
    rewriteConfig,
  );
  const comboService = new ProductComboRetrievalService();
  let mongoConnected = false;

  try {
    const lexical = await maybeCreateLexicalSearchService(args.mode);
    mongoConnected = Boolean(lexical);
    const retriever = new ProductRetriever(
      embeddings,
      qdrant,
      lexical,
      rewriteService,
      comboService,
    );
    const selectedCases = selectCases(args);
    const relevanceCorpus = await safeLoadRelevanceCorpus(qdrant);
    const report = await runBenchmarkForMode({
      mode: args.mode,
      retriever,
      selectedCases,
      relevanceCorpus,
      topK: args.topK,
      rewriteModel: rewriteConfig?.deepSeek.model,
      rewriteTimeoutMs: args.rewriteTimeoutMs,
      allowDeterministicShortCircuit: args.allowDeterministicShortCircuit,
    });

    const metadata: CliMetadata = {
      timestamp: new Date().toISOString(),
      collection: config.qdrant.collection,
      embeddingModel: config.openRouter.embeddingModel,
      qdrantCount: await safeCountProducts(qdrant),
      selectedCases: selectedCases.length,
      rewriteTimeoutMs: args.rewriteTimeoutMs,
      allowDeterministicShortCircuit: args.allowDeterministicShortCircuit,
    };
    const cliReport: CliReport = { ...report, ...metadata };

    if ('baseline' in cliReport) {
      cliReport.reportFiles = await writeProductRetrievalReports({
        reportDir: resolve(process.cwd(), args.reportDir),
        comparison: cliReport,
        formats: args.formats,
      });
    }

    if ('ablationReport' in cliReport) {
      cliReport.reportFiles = await writeProductRetrievalAblationReports({
        reportDir: resolve(process.cwd(), args.reportDir),
        ablation: cliReport,
        formats: args.formats,
      });
    }

    printReadableSummary(cliReport);
    console.log(JSON.stringify(cliReport, null, 2));
  } finally {
    if (mongoConnected) {
      await mongoose.disconnect();
    }
  }
}

function selectCases(args: BenchmarkArgs): BenchmarkCase[] {
  let cases = productRetrievalBenchmarkCases;
  if (args.queries?.length) {
    const allowed = new Set(args.queries);
    cases = cases.filter((benchmarkCase) => allowed.has(benchmarkCase.group));
  }
  return cases.slice(0, args.limit ?? cases.length);
}

async function runBenchmarkForMode(input: {
  mode: BenchmarkMode;
  retriever: ProductRetriever;
  selectedCases: BenchmarkCase[];
  relevanceCorpus: ProductSearchPayload[];
  topK: number;
  rewriteModel?: string;
  rewriteTimeoutMs: number;
  allowDeterministicShortCircuit: boolean;
}): Promise<
  BenchmarkCliReport | ProductRetrievalComparisonReport | ProductRetrievalAblationReport
> {
  if (input.mode === 'compare') {
    return runProductRetrievalComparison(input.retriever, input.selectedCases, {
      topK: input.topK,
      relevanceCorpus: input.relevanceCorpus,
      rewriteModel: input.rewriteModel,
      rewriteTimeoutMs: input.rewriteTimeoutMs,
      allowDeterministicShortCircuit: input.allowDeterministicShortCircuit,
    });
  }

  if (input.mode === 'ablation') {
    return runProductRetrievalAblation(input.retriever, input.selectedCases, {
      topK: input.topK,
      relevanceCorpus: input.relevanceCorpus,
      rewriteModel: input.rewriteModel,
      rewriteTimeoutMs: input.rewriteTimeoutMs,
      allowDeterministicShortCircuit: input.allowDeterministicShortCircuit,
    });
  }

  const pipelineVersion = pipelineForMode(input.mode);
  const benchmark = await runProductRetrievalBenchmark(
    input.retriever,
    input.selectedCases,
    {
      topK: input.topK,
      relevanceCorpus: input.relevanceCorpus,
      pipeline: pipelineVersion,
      rewriteTimeoutMs: input.rewriteTimeoutMs,
      allowDeterministicShortCircuit: input.allowDeterministicShortCircuit,
    }
  );

  return {
    benchmarkReport: true,
    mode: input.mode,
    pipelineVersion,
    secretKeysLogged: false,
    ...benchmark,
  };
}

async function maybeCreateLexicalSearchService(
  mode: BenchmarkMode,
): Promise<ProductLexicalSearchService | undefined> {
  if (mode !== 'ablation' || !process.env.MONGO_URI) return undefined;

  await mongoose.connect(process.env.MONGO_URI);
  const productModel = mongoose.model(Product.name, ProductSchema);
  return new ProductLexicalSearchService(productModel as any);
}

async function safeLoadRelevanceCorpus(
  qdrant: QdrantProductsClient,
): Promise<ProductSearchPayload[]> {
  if (typeof qdrant.listProductPayloads !== 'function') return [];

  try {
    return await qdrant.listProductPayloads();
  } catch {
    return [];
  }
}

async function safeCountProducts(
  qdrant: QdrantProductsClient,
): Promise<number | null> {
  try {
    return await qdrant.countProducts();
  } catch {
    return null;
  }
}

function printReadableSummary(report: CliReport): void {
  console.log('Product Retrieval Benchmark');
  console.log(`Collection: ${report.collection}`);
  console.log(`Embedding model: ${report.embeddingModel}`);
  console.log(`Queries: ${report.selectedCases}`);
  console.log(`Qdrant count: ${report.qdrantCount ?? 'unavailable'}`);
  console.log(`Rewrite timeout: ${report.rewriteTimeoutMs}ms`);
  console.log(
    `Deterministic rewrite short-circuit: ${report.allowDeterministicShortCircuit}`,
  );

  if ('baseline' in report) {
    console.log(`Baseline Recall@10: ${report.baseline.summary['Recall@10']}`);
    console.log(`Improved Recall@10: ${report.improved.summary['Recall@10']}`);
    console.log(`Delta Recall@10: ${report.deltas['Recall@10']}`);
    console.log(`Relative gate: ${report.relativeGate.passed ? 'passed' : 'failed'}`);
    return;
  }

  if ('ablationReport' in report) {
    console.log(`Ablation variants: ${report.variantOrder.join(', ')}`);
    console.log(
      `Dense Recall@10: ${report.variants.dense_vector_only.summary['Recall@10']}`,
    );
    console.log(
      `Full Recall@10: ${report.variants.phase_10_full.summary['Recall@10']}`,
    );
    console.log(
      `Full Delta Recall@10: ${report.deltasFromDense.phase_10_full['Recall@10']}`,
    );
    return;
  }

  console.log(`Recall@10: ${report.summary['Recall@10']}`);
  console.log(`Precision@5: ${report.summary['Precision@5']}`);
  console.log(`MRR: ${report.summary.MRR}`);
  console.log(`nDCG@10: ${report.summary['nDCG@10']}`);
  console.log(`Failure Rate: ${report.summary['Failure Rate']}`);
}

function requiredEnvForMode(mode: BenchmarkMode): string[] {
  if (mode === 'baseline') {
    return REQUIRED_ENV.filter((name) => name !== 'DEEPSEEK_API_KEY');
  }
  if (mode === 'ablation') return ABLATION_REQUIRED_ENV;
  return REQUIRED_ENV;
}

function pipelineForMode(
  mode: Exclude<BenchmarkMode, 'compare' | 'ablation'>,
): ProductRetrievalPipelineMode {
  return mode === 'baseline' ? 'phase-09.2-baseline' : 'phase-10-improved';
}

function isBenchmarkMode(value: string): value is BenchmarkMode {
  return (
    value === 'baseline' ||
    value === 'improved' ||
    value === 'compare' ||
    value === 'ablation'
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(
      JSON.stringify({
        error: 'benchmark_product_retrieval_failed',
        message: sanitizeCliError(error),
        secretKeysLogged: false,
      }),
    );
    process.exitCode = 1;
  });
}

function sanitizeCliError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [redacted]')
    .replace(/\b(sk|or|ds)-[A-Za-z0-9._-]{16,}\b/g, '[redacted]')
    .replace(
      /\b(api[_-]?key|token|authorization)(\s*[:=]\s*)[^\s,;]+/gi,
      '$1$2[redacted]',
    );
}
