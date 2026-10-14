import { describe, expect, test } from 'bun:test';
import type { Breadcrumb, ErrorEvent, EventHint } from '@sentry/react';
import { isNoise, scrubUrl, sentryOptions } from './sentry';

const axiosError = (status?: number, code?: string) => Object.assign(new Error('Request failed'), { isAxiosError: true, code, response: status ? { status } : undefined });

describe('isNoise', () => {
  test('client errors, network failures and cancels are noise', () => {
    expect(isNoise(axiosError(401))).toBe(true);
    expect(isNoise(axiosError(404))).toBe(true);
    expect(isNoise(axiosError(undefined, 'ERR_NETWORK'))).toBe(true);
    expect(isNoise(axiosError(undefined, 'ECONNABORTED'))).toBe(true);
    expect(isNoise(axiosError(undefined, 'ERR_CANCELED'))).toBe(true);
    expect(isNoise(Object.assign(new Error('x'), { name: 'AbortError' }))).toBe(true);
  });

  test('server errors and bugs are not', () => {
    expect(isNoise(axiosError(500))).toBe(false);
    expect(isNoise(new TypeError("Cannot read properties of undefined (reading 'x')"))).toBe(false);
    expect(isNoise('string')).toBe(false);
  });
});

describe('sentryOptions', () => {
  test('null without a DSN', () => {
    expect(sentryOptions({ SENTRY_DSN: '' })).toBeNull();
    expect(sentryOptions({})).toBeNull();
  });

  test('tunnel through the API, no replay, nothing personal', () => {
    const options = sentryOptions({ SENTRY_DSN: 'https://k@o1.ingest.sentry.io/3', SENTRY_ENVIRONMENT: 'production', SENTRY_RELEASE: 'abc', API_BASE_URL: 'https://jotihunt.example/api/', MODE: 'production' })!;
    expect(options.tunnel).toBe('https://jotihunt.example/api/sentry-tunnel');
    expect(options.environment).toBe('production');
    expect(options.release).toBe('abc');
    expect(options.replaysSessionSampleRate).toBeUndefined();
    expect(options.replaysOnErrorSampleRate).toBeUndefined();
    expect(options.integrations).toBeUndefined();
    expect(options.dataCollection).toEqual({ userInfo: false, urlQueryParams: false, cookies: false, httpHeaders: false });
  });

  test('environment falls back to the Vite mode', () => {
    expect(sentryOptions({ SENTRY_DSN: 'https://k@o1.ingest.sentry.io/3', MODE: 'development' })!.environment).toBe('development');
  });
});

describe('scrubUrl', () => {
  test('replaces tokens and codes in page and API paths', () => {
    expect(scrubUrl('https://jotihunt.example/invite/AbC-123')).toBe('https://jotihunt.example/invite/:code');
    expect(scrubUrl('https://jotihunt.example/herstel/s3cr3t')).toBe('https://jotihunt.example/herstel/:token');
    expect(scrubUrl('/l/q1w2e3')).toBe('/l/:code');
    expect(scrubUrl('https://jotihunt.example/api/invites/AbC/register/options')).toBe('https://jotihunt.example/api/invites/:code/register/options');
    expect(scrubUrl('https://jotihunt.example/api/herstel/s3cr3t/no-passkey')).toBe('https://jotihunt.example/api/herstel/:token/no-passkey');
    expect(scrubUrl('https://jotihunt.example/api/auth/qr/scan/q1w2e3/approve')).toBe('https://jotihunt.example/api/auth/qr/scan/:code/approve');
  });

  test('drops query strings and fragments', () => {
    expect(scrubUrl('https://jotihunt.example/api/tracker?token=abc#x')).toBe('https://jotihunt.example/api/tracker');
    expect(scrubUrl('/hints?article=3')).toBe('/hints');
  });

  test('leaves other URLs alone', () => {
    expect(scrubUrl('https://jotihunt.example/hints')).toBe('https://jotihunt.example/hints');
    expect(scrubUrl('/')).toBe('/');
  });
});

describe('scrubbing in sentryOptions', () => {
  const options = sentryOptions({ SENTRY_DSN: 'https://k@o1.ingest.sentry.io/3' })!;
  const send = (event: ErrorEvent, hint: EventHint = {}) => (options.beforeSend as (event: ErrorEvent, hint: EventHint) => ErrorEvent | null)(event, hint);
  const crumb = (breadcrumb: Breadcrumb) => options.beforeBreadcrumb!(breadcrumb);

  test('beforeSend scrubs the request url and transaction', () => {
    const event = send({ type: undefined, request: { url: 'https://jotihunt.example/herstel/s3cr3t?a=1' }, transaction: '/invite/AbC' });
    expect(event?.request?.url).toBe('https://jotihunt.example/herstel/:token');
    expect(event?.transaction).toBe('/invite/:code');
  });

  test('beforeSend still drops noise', () => {
    expect(send({ type: undefined, request: { url: 'https://jotihunt.example/' } }, { originalException: axiosError(404) })).toBeNull();
  });

  test('beforeBreadcrumb scrubs navigation and fetch/xhr urls', () => {
    expect(crumb({ category: 'navigation', data: { from: '/invite/AbC', to: '/herstel/s3cr3t?x=1' } })?.data).toEqual({ from: '/invite/:code', to: '/herstel/:token' });
    expect(crumb({ category: 'fetch', data: { url: 'https://jotihunt.example/api/invites/AbC?x=1', method: 'GET' } })?.data).toEqual({ url: 'https://jotihunt.example/api/invites/:code', method: 'GET' });
    expect(crumb({ category: 'xhr', data: { url: '/api/tracker?token=abc' } })?.data).toEqual({ url: '/api/tracker' });
  });

  test('beforeBreadcrumb leaves other breadcrumbs alone', () => {
    const breadcrumb = { category: 'ui.click', message: 'button' };
    expect(crumb(breadcrumb)).toBe(breadcrumb);
  });
});
