/**
 * Sanity checks for polled API responses. A proxy error page or an error object answered with status 200 must not
 * reach the components (they call `.filter` / `.map` on it and white-screen the app): such a response counts as a
 * failed fetch instead, so SWR keeps the last good data and the error/stale indicators show.
 */

/** GET endpoints that answer with a JSON array. */
const LIST_PATHS = new Set([
  '/markers',
  '/areas',
  '/hunts',
  '/hunt-reports',
  '/teams',
  '/predictions',
  '/visits',
  '/tracker/positions',
  '/tracker/devices',
  '/articles',
  '/admin/users',
]);

const isObject = (data: unknown): data is Record<string, unknown> => typeof data === 'object' && data !== null && !Array.isArray(data);

/** Endpoints whose object answer needs more than "is an object". */
const OBJECT_CHECKS: Record<string, (data: Record<string, unknown>) => boolean> = {
  '/hints/board': (data) => Array.isArray(data.articles) && Array.isArray(data.cells),
  '/demo': (data) => typeof data.enabled === 'boolean',
  '/notifications/preferences': (data) => Array.isArray(data.disabledTypes),
};

/** Whether `data` has the shape the client expects for a GET of `url` (path, optionally with a query string). */
export function hasExpectedShape(url: string, data: unknown): boolean {
  const path = url.split('?')[0];
  if (LIST_PATHS.has(path)) return Array.isArray(data);
  if (!isObject(data)) return false;
  return OBJECT_CHECKS[path]?.(data) ?? true;
}

/** The list itself, or an empty list for anything that is not an array (e.g. a malformed cached value). */
export function asList<T>(data: T[] | null | undefined | unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}

export class UnexpectedResponseError extends Error {
  constructor(url: string) {
    super(`Onverwacht antwoord van de server (${url.split('?')[0]})`);
    this.name = 'UnexpectedResponseError';
  }
}
