import { argv } from 'node:process';

import {
  profileCrawlProducts,
  readCrawlJson,
  writeJsonReport,
} from '../src/product-corpus/product-corpus.normalizer';

type ProfileArgs = {
  source: string;
  limit?: number;
  report?: string;
};

function parseArgs(rawArgs: string[]): ProfileArgs {
  return rawArgs.reduce<ProfileArgs>(
    (parsed, arg) => {
      if (arg.startsWith('--source=')) parsed.source = arg.slice('--source='.length);
      if (arg.startsWith('--limit=')) {
        const limit = Number(arg.slice('--limit='.length));
        if (Number.isFinite(limit) && limit > 0) parsed.limit = Math.floor(limit);
      }
      if (arg.startsWith('--report=')) parsed.report = arg.slice('--report='.length);
      return parsed;
    },
    { source: '../data/products_crawl.json' },
  );
}

async function main(): Promise<void> {
  const args = parseArgs(argv.slice(2));
  const rows = await readCrawlJson(args.source);
  const limitedRows = args.limit ? rows.slice(0, args.limit) : rows;
  const report = profileCrawlProducts(limitedRows, { sourceFile: args.source });

  if (args.report) {
    await writeJsonReport(args.report, report);
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      error: 'profile_crawl_products_failed',
      message: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exitCode = 1;
});
