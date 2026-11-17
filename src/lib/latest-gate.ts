/**
 * Sequence ids per key, so only the answer to the latest write counts: a slower answer to an earlier write (status A,
 * then B; A answers last) is recognised as stale and ignored instead of undoing B.
 */
export interface LatestGate<K> {
  /** Start a write for `key`; returns its ticket */
  next: (key: K) => number;
  /** Whether `ticket` is still the latest write for `key` */
  isLatest: (key: K, ticket: number) => boolean;
}

export function latestGate<K>(): LatestGate<K> {
  const latest = new Map<K, number>();
  let counter = 0;
  return {
    next: (key) => {
      counter += 1;
      latest.set(key, counter);
      return counter;
    },
    isLatest: (key, ticket) => latest.get(key) === ticket,
  };
}
