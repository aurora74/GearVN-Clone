import { join, resolve } from 'node:path';
import { argv } from 'node:process';

import { readAiRetrievalConfig } from '../src/ai/config/ai-retrieval.config';
import { readDeepSeekRewriteConfig } from '../src/ai/config/deepseek-rewrite.config';
import { OpenRouterBgeM3Client } from '../src/ai/embeddings/openrouter-bge-m3.client';
import { DeepSeekQueryRewriteClient } from '../src/ai/retrieval/deepseek-query-rewrite.client';
import { ProductComboRetrievalService } from '../src/ai/retrieval/product-combo-retrieval.service';
import { ProductQueryRewriteService } from '../src/ai/retrieval/product-query-rewrite.service';
import { productRetrievalBenchmarkCases } from '../src/ai/retrieval/product-retrieval.benchmark-cases';
import {
  ProductRetrievalBenchmarkReport,
  ProductRetrievalComparisonReport,
  runProductRetrievalBenchmark,
  runProductRetrievalComparison,
} from '../src/ai/retrieval/product-retrieval.benchmark';
import {
  ProductRetrievalReportFormat,
  writeProductRetrievalReports,
} from '../src/ai/retrieval/product-retrieval-report-export';
import { ProductRetriever } from '../src/ai/retrieval/product-retriever';
import {
  BenchmarkCase,
  ProductRetrievalPipelineMode,
  ProductSearchPayload,
} from '../src/ai/retrieval/product-retrieval.types';
import { QdrantProductsClient } from '../src/ai/vector/qdrant-products.client';
import { loadLocalEnv, requireEnvPresence } from './script-env';

type BenchmarkMode = 'baseline' | 'improved' | 'compare';

type BenchmarkArgs = {
  limit?: number;
  topK: number;
  queries?: BenchmarkCase['group'][];
  mode: BenchmarkMode;
  reportDir: string;
  formats: ProductRetrievalReportFormat[];
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

type CliMetadata = {
  timestamp: string;
  collection: string;
  embeddingModel: string;
  qdrantCount: number | null;
  selectedCases: number;
};

type CliReport = (BenchmarkCliReport | ComparisonCliReport) & CliMetadata;

const REQUIRED_ENV = [
  'OPENROUTER_API_KEY',
  'QDRANT_URL',
  'QDRANT_API_KEY',
  'DEEPSEEK_API_KEY',
];
const QUERY_GROUPS: BenchmarkCase['group'][] = [
  'keyword',
  'need_based',
  'gift',
  'technical',
  'combo',
  'ambiguous',
];
const REPORT_FORMATS: ProductRetrievalReportFormat[] = ['json', 'csv', 'md'];

function parseArgs(rawArgs: string[]): BenchmarkArgs {
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
      reportDir: join('reports', 'phase-10-retrieval', String(Date.now())),
      formats: REPORT_FORMATS,
    },
  );
}

async function main(): Promise<void> {
  loadLocalEnv();
  const args = parseArgs(argv.slice(2));
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
  const rewriteService = new ProductQueryRewriteService(rewriteClient);
  const comboService = new ProductComboRetrievalService();
  const retriever = new ProductRetriever(
    embeddings,
    qdrant,
    undefined,
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
  });

  const metadata: CliMetadata = {
    timestamp: new Date().toISOString(),
    collection: config.qdrant.collection,
    embeddingModel: config.openRouter.embeddingModel,
    qdrantCount: await safeCountProducts(qdrant),
    selectedCases: selectedCases.length,
  };
  const cliReport: CliReport = { ...report, ...metadata };

  if ('baseline' in cliReport) {
    cliReport.reportFiles = await writeProductRetrievalReports({
      reportDir: resolve(process.cwd(), args.reportDir),
      comparison: cliReport,
      formats: args.formats,
    });
  }

  printReadableSummary(cliReport);
  console.log(JSON.stringify(cliReport, null, 2));
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
}): Promise<BenchmarkCliReport | ProductRetrievalComparisonReport> {
  if (input.mode === 'compare') {
    return runProductRetrievalComparison(input.retriever, input.selectedCases, {
      topK: input.topK,
      relevanceCorpus: input.relevanceCorpus,
      rewriteModel: input.rewriteModel,
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
    },
  );

  return {
    benchmarkReport: true,
    mode: input.mode,
    pipelineVersion,
    secretKeysLogged: false,
    ...benchmark,
  };
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

  if ('baseline' in report) {
    console.log(`Baseline Recall@10: ${report.baseline.summary['Recall@10']}`);
    console.log(`Improved Recall@10: ${report.improved.summary['Recall@10']}`);
    console.log(`Delta Recall@10: ${report.deltas['Recall@10']}`);
    console.log(`Relative gate: ${report.relativeGate.passed ? 'passed' : 'failed'}`);
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
  return REQUIRED_ENV;
}

function pipelineForMode(mode: Exclude<BenchmarkMode, 'compare'>): ProductRetrievalPipelineMode {
  return mode === 'baseline' ? 'phase-09.2-baseline' : 'phase-10-improved';
}

function isBenchmarkMode(value: string): value is BenchmarkMode {
  return value === 'baseline' || value === 'improved' || value === 'compare';
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      error: 'benchmark_product_retrieval_failed',
      message: error instanceof Error ? error.message : String(error),
      secretKeysLogged: false,
    }),
  );
  process.exitCode = 1;
});
