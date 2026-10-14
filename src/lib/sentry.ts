import { replayIntegration, type BrowserOptions } from '@sentry/react';

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

/**
 * Sentry options from the runtime environment, or null without SENTRY_DSN. Reports go through the API's
 * /sentry-tunnel (ad blockers block sentry.io). Errors only; a replay is kept only for sessions with an error, with
 * all text and inputs masked and the map blocked (it shows everyone's position).
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
    integrations: [replayIntegration({ maskAllText: true, maskAllInputs: true, blockAllMedia: true, block: ['.maplibregl-map'] })],
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    ignoreErrors: ['ResizeObserver loop', 'Failed to fetch dynamically imported module', 'Importing a module script failed', 'Load failed'],
    beforeSend: (event, hint) => (isNoise(hint.originalException) ? null : event),
  };
}
