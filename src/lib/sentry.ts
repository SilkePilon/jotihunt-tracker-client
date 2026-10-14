import type { BrowserOptions } from '@sentry/react';

interface AxiosLike {
  isAxiosError: true;
  code?: string;
  response?: { status?: number };
}

const NETWORK_CODES = new Set(['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT', 'ERR_CANCELED']);

/** Expected failures on a phone in the field (4xx answers, no signal, cancelled requests) are not bugs. */
export function isNoise(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'AbortError' || error.name === 'CanceledError') return true;
  const axios = error as Partial<AxiosLike>;
  if (axios.isAxiosError !== true) return false;
  const status = axios.response?.status;
  if (status !== undefined) return status >= 400 && status < 500;
  return NETWORK_CODES.has(axios.code ?? '');
}

// Path segments that are secrets: invite and QR login codes, recovery tokens (pages and their API calls)
const SECRET_SEGMENTS: [RegExp, string][] = [
  [/\/(invites?|l|qr\/scan)\/[^/]+/g, '/$1/:code'],
  [/\/herstel\/[^/]+/g, '/herstel/:token'],
];

/** A page or request URL safe to send: no query string or fragment, no codes or tokens in the path. */
export function scrubUrl(url: string): string {
  let scrubbed = url.split(/[?#]/)[0];
  for (const [pattern, replacement] of SECRET_SEGMENTS) scrubbed = scrubbed.replace(pattern, replacement);
  return scrubbed;
}

/**
 * Sentry options from the runtime environment, or null without SENTRY_DSN. Reports go through the API's
 * /sentry-tunnel (ad blockers block sentry.io). Errors only, no session replay; URLs in events and breadcrumbs are
 * scrubbed (invite/recovery links hold secrets).
 */
export function sentryOptions(env: { SENTRY_DSN?: string; SENTRY_ENVIRONMENT?: string; SENTRY_RELEASE?: string; API_BASE_URL?: string; MODE?: string }): BrowserOptions | null {
  const dsn = env.SENTRY_DSN?.trim();
  if (!dsn) return null;
  return {
    dsn,
    environment: env.SENTRY_ENVIRONMENT?.trim() || env.MODE || 'production',
    release: env.SENTRY_RELEASE || undefined,
    tunnel: env.API_BASE_URL ? `${env.API_BASE_URL.replace(/\/$/, '')}/sentry-tunnel` : undefined,
    dataCollection: { userInfo: false, urlQueryParams: false, cookies: false, httpHeaders: false },
    ignoreErrors: ['ResizeObserver loop', 'Failed to fetch dynamically imported module', 'Importing a module script failed', 'Load failed'],
    beforeSend: (event, hint) => {
      if (isNoise(hint.originalException)) return null;
      if (event.request?.url) event.request.url = scrubUrl(event.request.url);
      if (event.transaction) event.transaction = scrubUrl(event.transaction);
      return event;
    },
    beforeBreadcrumb: (breadcrumb) => {
      const data = breadcrumb.data;
      if (!data) return breadcrumb;
      if (breadcrumb.category === 'navigation') {
        if (typeof data.from === 'string') data.from = scrubUrl(data.from);
        if (typeof data.to === 'string') data.to = scrubUrl(data.to);
      } else if ((breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') && typeof data.url === 'string') {
        data.url = scrubUrl(data.url);
      }
      return breadcrumb;
    },
  };
}
