import { apiErrorStatus } from '@/lib/api-error';

/** Absolute API base (the configured base may be relative to the site, e.g. "/api"), without trailing slash. */
function absoluteBase(apiBase: string, origin: string): string {
  return new URL(apiBase || '/', origin.endsWith('/') ? origin : `${origin}/`).toString().replace(/\/+$/, '');
}

/** QR / deep-link payload the Android app understands. */
export function buildPairingUrl(apiBase: string, code: string, origin: string): string {
  return `jotihunt://pair?api=${encodeURIComponent(absoluteBase(apiBase, origin))}&code=${code}`;
}

/** Absolute URL of an API path (for links like the APK download). */
export function absoluteUrl(apiBase: string, path: string, origin: string): string {
  return `${absoluteBase(apiBase, origin)}${path}`;
}

/** "ABCD2345" → "ABCD-2345" (easier to type over). */
export function formatPairingCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

/** Whole seconds until `expiresAt`, never negative. */
export function secondsLeft(expiresAt: string, now: number): number {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000));
}

/** Runs the GET for the latest release: the release, or null when the server has none (404); anything else rethrows. */
export async function fetchLatestRelease<T>(get: () => Promise<T>): Promise<T | null> {
  try {
    return await get();
  } catch (error) {
    if (apiErrorStatus(error) === 404) return null;
    throw error;
  }
}
