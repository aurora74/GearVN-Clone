import { CounterMap } from './product-corpus.types';

export function incrementCounter(
  counter: CounterMap,
  key: string | undefined,
  amount = 1,
): CounterMap {
  const normalizedKey = key?.trim() || 'unknown';
  counter[normalizedKey] = (counter[normalizedKey] ?? 0) + amount;
  return counter;
}

export function sortedCounter(counter: CounterMap): CounterMap {
  return Object.entries(counter)
    .sort(([left], [right]) => left.localeCompare(right))
    .reduce<CounterMap>((sorted, [key, value]) => {
      sorted[key] = value;
      return sorted;
    }, {});
}

export function summarizeSkippedReasons(
  skipped: Array<{ reason: string }>,
): CounterMap {
  return skipped.reduce<CounterMap>((summary, item) => {
    incrementCounter(summary, item.reason);
    return summary;
  }, {});
}
