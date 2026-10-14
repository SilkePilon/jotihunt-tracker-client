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
  '/admin/invites',
  '/admin/broadcasts',
  '/assignments',
  '/assignments/members',
]);

const isObject = (data: unknown): data is Record<string, unknown> => typeof data === 'object' && data !== null && !Array.isArray(data);

/** Endpoints whose object answer needs more than "is an object". */
const OBJECT_CHECKS: Record<string, (data: Record<string, unknown>) => boolean> = {
  '/hints/board': (data) => Array.isArray(data.articles) && Array.isArray(data.cells),
  '/demo': (data) => typeof data.enabled === 'boolean',
  '/notifications/preferences': (data) => Array.isArray(data.disabledTypes),
  '/articles/read': (data) => Array.isArray(data.read) && isObject(data.readBy),
  '/counter-hunt': (data) => typeof data.active === 'boolean',
  '/happy-hour': (data) => data.state === 'none' || ((data.state === 'upcoming' || data.state === 'active') && typeof data.startsAt === 'string' && typeof data.endsAt === 'string'),
  '/telegram/messages': (data) => typeof data.linked === 'boolean' && typeof data.connected === 'boolean' && Array.isArray(data.messages),
  '/admin/telegram': (data) => typeof data.state === 'string' && typeof data.connected === 'boolean',
  '/admin/life360': (data) => typeof data.state === 'string',
  '/life360/members': (data) => typeof data.linked === 'boolean' && typeof data.stale === 'boolean' && Array.isArray(data.members),
  '/settings/invites-paused': (data) => typeof data.paused === 'boolean',
  '/settings/huntable-areas': (data) => data.areas === null || (Array.isArray(data.areas) && data.areas.every((area) => typeof area === 'string')),
  '/account': (data) => Array.isArray(data.passkeys) && Array.isArray(data.sessions) && Array.isArray(data.devices),
};

/** Whether `data` has the shape the client expects for a GET of `url` (path, optionally with a query string). */
export function hasExpectedShape(url: string, data: unknown): boolean {
  const path = url.split('?')[0];
  if (LIST_PATHS.has(path)) return Array.isArray(data);
  if (!isObject(data)) return false;
  return OBJECT_CHECKS[path]?.(data) ?? true;
}

/**
 * For hooks that return a polled list: undefined while loading stays undefined, anything else that is not an array
 * (a malformed cached value) becomes an empty list, so the components never call `.filter` on an object.
 */
export function asList<T>(data: T[] | undefined): T[] | undefined {
  if (data === undefined) return undefined;
  return Array.isArray(data) ? data : [];
}

export class UnexpectedResponseError extends Error {
  constructor(url: string) {
    super(`Onverwacht antwoord van de server (${url.split('?')[0]})`);
    this.name = 'UnexpectedResponseError';
  }
}
