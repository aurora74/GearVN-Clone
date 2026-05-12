import {
  loadEnvFromFile,
  redactConfigForReport,
  requireEnvPresence,
} from '../../../scripts/script-env';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('script env helpers', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('loads dotenv values without overriding existing process env values', () => {
    const dir = mkdtempSync(join(tmpdir(), 'script-env-'));
    const envFile = join(dir, '.env');

    process.env.OPENROUTER_API_KEY = 'already-set';
    writeFileSync(
      envFile,
      [
        'OPENROUTER_API_KEY=from-file',
        'QDRANT_COLLECTION=products',
        '# ignored comment',
      ].join('\n'),
    );

    try {
      loadEnvFromFile(envFile);

      expect(process.env.OPENROUTER_API_KEY).toBe('already-set');
      expect(process.env.QDRANT_COLLECTION).toBe('products');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reports env presence by name without exposing secret values', () => {
    process.env.OPENROUTER_API_KEY = 'secret-token';

    expect(
      requireEnvPresence(['OPENROUTER_API_KEY', 'QDRANT_API_KEY']),
    ).toEqual({
      OPENROUTER_API_KEY: { present: true },
      QDRANT_API_KEY: { present: false },
    });
  });

  it('redacts configured secrets while preserving non-secret metadata', () => {
    expect(
      redactConfigForReport(
        {
          OPENROUTER_API_KEY: 'secret-token',
          OPENROUTER_EMBEDDING_MODEL: 'baai/bge-m3',
          QDRANT_COLLECTION: 'products',
        },
        ['OPENROUTER_API_KEY'],
      ),
    ).toEqual({
      OPENROUTER_API_KEY: { present: true },
      OPENROUTER_EMBEDDING_MODEL: 'baai/bge-m3',
      QDRANT_COLLECTION: 'products',
    });
  });
});
