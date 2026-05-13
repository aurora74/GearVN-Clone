import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type EnvPresenceReport = Record<string, { present: boolean }>;
export type RedactedConfigReport = Record<
  string,
  unknown | { present: boolean }
>;

export function loadEnvFromFile(filePath: string): void {
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) continue;

    const equalIndex = line.indexOf('=');
    if (equalIndex <= 0) continue;

    const key = line.slice(0, equalIndex).trim();
    const value = line.slice(equalIndex + 1).trim();

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

export function loadLocalEnv(): void {
  loadEnvFromFile(resolve(process.cwd(), '.env'));
}

export function requireEnvPresence(requiredNames: string[]): EnvPresenceReport {
  return requiredNames.reduce<EnvPresenceReport>((report, name) => {
    report[name] = { present: Boolean(process.env[name]) };
    return report;
  }, {});
}

export function redactConfigForReport(
  config: Record<string, unknown>,
  secretKeys: string[],
): RedactedConfigReport {
  const secrets = new Set(secretKeys);

  return Object.entries(config).reduce<RedactedConfigReport>(
    (report, [key, value]) => {
      report[key] = secrets.has(key) ? { present: Boolean(value) } : value;
      return report;
    },
    {},
  );
}
