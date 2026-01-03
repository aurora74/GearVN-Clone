export function toCamelCase(str: string): string {
  if (!str) return str;

  if (str === str.toUpperCase()) {
    return str.toLowerCase();
  }

  return str
    .replace(/[-_ ]+(\w)/g, (_, c) => c.toUpperCase())
    .replace(/^./, (c) => c.toLowerCase());
}
