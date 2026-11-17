/** Where a polled list stands: still loading, failed before anything came in, or here (possibly empty). */
export type LoadState = 'loading' | 'error' | 'ready';

/**
 * A fetch's state for its view: data wins (a failed later poll keeps showing the last data); without data, an error
 * means the first load failed, else it is still loading.
 */
export function loadState(data: unknown, error: unknown): LoadState {
  if (data !== undefined && data !== null) return 'ready';
  return error ? 'error' : 'loading';
}

/** Several fetches that make up one view: ready once all are here, failed when one failed without data. */
export function combinedLoadState(...states: LoadState[]): LoadState {
  if (states.every((state) => state === 'ready')) return 'ready';
  return states.includes('error') ? 'error' : 'loading';
}
