import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { argv } from 'node:process';
import mongoose from 'mongoose';

import { readAiRetrievalConfig } from '../src/ai/config/ai-retrieval.config';
import { productRetrievalBenchmarkCases } from '../src/ai/retrieval/product-retrieval.benchmark-cases';
import { BenchmarkCase } from '../src/ai/retrieval/product-retrieval.types';
import { QdrantProductsClient } from '../src/ai/vector/qdrant-products.client';
import { Product, ProductSchema } from '../src/product/product.schema';
import { loadLocalEnv, requireEnvPresence } from './script-env';

type AuditArgs = {
  reportDir: string;
};

type AuditProductRecord = {
  _id: unknown;
  isPublished?: boolean;
  isArchived?: boolean;
  stock?: number;
};

export type QrelsAuditReport = {
  qrelsAuditReport: true;
  totalCases: number;
  nonAmbiguousCases: number;
  expectedClarificationCases: number;
  manualBinaryQrelsCases: number;
  expectedProductIdCases: number;
  categoryCorpusFallbackCases: number;
  missingMongoProductIds: string[];
  missingQdrantProductIds: string[];
  duplicateProductIdsByCase: Record<string, string[]>;
  unpublishedProductIds: string[];
  archivedProductIds: string[];
  unavailableProductIds: string[];
  zeroLabelRequiredCases: string[];
  expectedClarificationCasesWithProductLabels: string[];
  valid: boolean;
  secretKeysLogged: false;
};

const DEFAULT_REPORT_DIR = 'reports/phase-10-retrieval/chapter-4-final';
const REQUIRED_ENV = ['MONGO_URI', 'QDRANT_URL', 'QDRANT_API_KEY'];

function parseArgs(rawArgs: string[]): AuditArgs {
  return rawArgs.reduce<AuditArgs>(
    (parsed, arg) => {
      if (arg.startsWith('--reportDir=')) {
        const reportDir = arg.slice('--reportDir='.length).trim();
        if (reportDir) parsed.reportDir = reportDir;
      }
      return parsed;
    },
    { reportDir: DEFAULT_REPORT_DIR },
  );
}

export function auditBenchmarkQrels(input: {
  cases: BenchmarkCase[];
  mongoProducts: AuditProductRecord[];
  qdrantProductIds: string[];
}): QrelsAuditReport {
  const mongoProductsById = new Map(
    input.mongoProducts.map((product) => [String(product._id), product]),
  );
  const qdrantProductIds = new Set(input.qdrantProductIds);
  const allLabelIds = new Set<string>();
  const duplicateProductIdsByCase: Record<string, string[]> = {};
  const zeroLabelRequiredCases: string[] = [];
  const expectedClarificationCasesWithProductLabels: string[] = [];
  let manualBinaryQrelsCases = 0;
  let expectedProductIdCases = 0;
  let expectedClarificationCases = 0;
  let categoryCorpusFallbackCases = 0;

  for (const benchmarkCase of input.cases) {
    const labelIds = labelIdsForCase(benchmarkCase);
    labelIds.forEach((productId) => allLabelIds.add(productId));

    if (benchmarkCase.expectedQrels?.length) manualBinaryQrelsCases += 1;
    if (benchmarkCase.expectedProductIds?.length) expectedProductIdCases += 1;
    if (benchmarkCase.expectedClarification === true) {
      expectedClarificationCases += 1;
      if (labelIds.length > 0) {
        expectedClarificationCasesWithProductLabels.push(benchmarkCase.id);
      }
    } else if (labelIds.length === 0) {
      zeroLabelRequiredCases.push(benchmarkCase.id);
      categoryCorpusFallbackCases += 1;
    }

    const duplicates = duplicateIds(labelIds);
    if (duplicates.length > 0) {
      duplicateProductIdsByCase[benchmarkCase.id] = duplicates;
    }
  }

  const sortedLabelIds = Array.from(allLabelIds).sort(compareIds);
  const missingMongoProductIds = sortedLabelIds.filter(
    (productId) => !mongoProductsById.has(productId),
  );
  const missingQdrantProductIds = sortedLabelIds.filter(
    (productId) => !qdrantProductIds.has(productId),
  );
  const productsForLabels = sortedLabelIds
    .map((productId) => mongoProductsById.get(productId))
    .filter((product): product is AuditProductRecord => Boolean(product));
  const unpublishedProductIds = productsForLabels
    .filter((product) => product.isPublished === false)
    .map((product) => String(product._id))
    .sort(compareIds);
  const archivedProductIds = productsForLabels
    .filter((product) => product.isArchived === true)
    .map((product) => String(product._id))
    .sort(compareIds);
  const unavailableProductIds = productsForLabels
    .filter((product) => typeof product.stock === 'number' && product.stock <= 0)
    .map((product) => String(product._id))
    .sort(compareIds);
  const invalidCounts = [
    missingMongoProductIds.length,
    missingQdrantProductIds.length,
    Object.keys(duplicateProductIdsByCase).length,
    unpublishedProductIds.length,
    archivedProductIds.length,
    unavailableProductIds.length,
    zeroLabelRequiredCases.length,
    expectedClarificationCasesWithProductLabels.length,
  ];

  return {
    qrelsAuditReport: true,
    totalCases: input.cases.length,
    nonAmbiguousCases: input.cases.filter(
      (benchmarkCase) => benchmarkCase.expectedClarification !== true,
    ).length,
    expectedClarificationCases,
    manualBinaryQrelsCases,
    expectedProductIdCases,
    categoryCorpusFallbackCases,
    missingMongoProductIds,
    missingQdrantProductIds,
    duplicateProductIdsByCase,
    unpublishedProductIds,
    archivedProductIds,
    unavailableProductIds,
    zeroLabelRequiredCases,
    expectedClarificationCasesWithProductLabels,
    valid: invalidCounts.every((count) => count === 0),
    secretKeysLogged: false,
  };
}

function labelIdsForCase(benchmarkCase: BenchmarkCase): string[] {
  if (benchmarkCase.expectedQrels?.length) {
    return benchmarkCase.expectedQrels.map((qrel) => qrel.productId);
  }
  return benchmarkCase.expectedProductIds ?? [];
}

function duplicateIds(productIds: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const productId of productIds) {
    if (seen.has(productId)) duplicates.add(productId);
    seen.add(productId);
  }
  return Array.from(duplicates).sort(compareIds);
}

function compareIds(left: string, right: string): number {
  return left.localeCompare(right);
}

async function main(): Promise<void> {
  loadLocalEnv();
  const args = parseArgs(argv.slice(2));
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

  const productIds = Array.from(
    new Set(productRetrievalBenchmarkCases.flatMap(labelIdsForCase)),
  ).sort(compareIds);
  const productModel = mongoose.model(Product.name, ProductSchema);

  await mongoose.connect(process.env.MONGO_URI as string);
  try {
    const mongoProducts = await productModel
      .find({ _id: { $in: productIds } })
      .select('_id isPublished isArchived stock')
      .lean()
      .exec();
    const qdrant = new QdrantProductsClient({
      config: readAiRetrievalConfig({ requireSecrets: true }),
    });
    const qdrantProductIds = await qdrant.listProductPayloadIds();
    const report = auditBenchmarkQrels({
      cases: productRetrievalBenchmarkCases,
      mongoProducts,
      qdrantProductIds,
    });

    writeReports(args.reportDir, report);
    console.log(JSON.stringify(report, null, 2));
    if (!report.valid) process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

function writeReports(reportDir: string, report: QrelsAuditReport): void {
  const absoluteReportDir = resolve(process.cwd(), reportDir);
  mkdirSync(absoluteReportDir, { recursive: true });
  writeFileSync(
    resolve(absoluteReportDir, 'qrels-audit.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
  writeFileSync(
    resolve(absoluteReportDir, 'qrels-audit.md'),
    `${buildAuditMarkdown(report)}\n`,
    'utf8',
  );
}

function buildAuditMarkdown(report: QrelsAuditReport): string {
  return [
    '# Product Retrieval Qrels Audit',
    '',
    `- Valid: ${report.valid}`,
    `- Secret keys logged: ${report.secretKeysLogged}`,
    `- Total cases: ${report.totalCases}`,
    `- Non-ambiguous cases: ${report.nonAmbiguousCases}`,
    `- Manual binary qrels cases: ${report.manualBinaryQrelsCases}`,
    `- Expected product ID cases: ${report.expectedProductIdCases}`,
    `- Expected clarification cases: ${report.expectedClarificationCases}`,
    `- Category corpus fallback cases: ${report.categoryCorpusFallbackCases}`,
    '',
    '## Invalid Label Findings',
    '',
    `- Missing Mongo product IDs: ${formatList(report.missingMongoProductIds)}`,
    `- Missing Qdrant product IDs: ${formatList(report.missingQdrantProductIds)}`,
    `- Duplicate product IDs by case: ${formatDuplicates(report.duplicateProductIdsByCase)}`,
    `- Unpublished product IDs: ${formatList(report.unpublishedProductIds)}`,
    `- Archived product IDs: ${formatList(report.archivedProductIds)}`,
    `- Unavailable product IDs: ${formatList(report.unavailableProductIds)}`,
    `- Zero-label required cases: ${formatList(report.zeroLabelRequiredCases)}`,
    `- Expected clarification cases with product labels: ${formatList(report.expectedClarificationCasesWithProductLabels)}`,
  ].join('\n');
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(', ') : 'none';
}

function formatDuplicates(values: Record<string, string[]>): string {
  const entries = Object.entries(values);
  if (entries.length === 0) return 'none';
  return entries
    .map(([caseId, productIds]) => `${caseId}: ${productIds.join(', ')}`)
    .join('; ');
}

function sanitizeCliError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [redacted]')
    .replace(/\b(sk|or|ds)-[A-Za-z0-9._-]{16,}\b/g, '[redacted]')
    .replace(
      /\b(api[_-]?key|token|authorization)(\s*[:=]\s*)[^\s,;]+/gi,
      '$1$2[redacted]',
    )
    .replace(/mongodb(\+srv)?:\/\/[^\s,;]+/gi, 'mongodb$1://[redacted]');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(
      JSON.stringify({
        error: 'audit_product_retrieval_qrels_failed',
        message: sanitizeCliError(error),
        secretKeysLogged: false,
      }),
    );
    process.exitCode = 1;
  });
}
