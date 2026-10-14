import { describe, expect, test } from 'bun:test';
import { isNoise, sentryOptions } from './sentry';

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

  test('tunnel through the API, replay only on error, nothing personal', () => {
    const options = sentryOptions({ SENTRY_DSN: 'https://k@o1.ingest.sentry.io/3', SENTRY_ENVIRONMENT: 'production', SENTRY_RELEASE: 'abc', API_BASE_URL: 'https://jotihunt.example/api/', MODE: 'production' })!;
    expect(options.tunnel).toBe('https://jotihunt.example/api/sentry-tunnel');
    expect(options.environment).toBe('production');
    expect(options.release).toBe('abc');
    expect(options.replaysSessionSampleRate).toBe(0);
    expect(options.replaysOnErrorSampleRate).toBe(1);
    expect(options.dataCollection).toEqual({ userInfo: false, urlQueryParams: false, cookies: false, httpHeaders: false });
  });

  test('environment falls back to the Vite mode', () => {
    expect(sentryOptions({ SENTRY_DSN: 'https://k@o1.ingest.sentry.io/3', MODE: 'development' })!.environment).toBe('development');
  });
});
