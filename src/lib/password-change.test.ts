import { describe, expect, test } from 'bun:test';
import axios, { AxiosError, AxiosHeaders, type AxiosAdapter } from 'axios';
import { installPasswordChangeInterceptor, isPasswordChangeRequired, onPasswordChangeRequired, reportIfPasswordChangeRequired } from './password-change';

function httpError(status: number, data: unknown) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, { status, statusText: '', headers: {}, config, data });
}

const required = () => httpError(403, { message: 'Wijzig eerst je wachtwoord.', code: 'PASSWORD_CHANGE_REQUIRED' });

describe('isPasswordChangeRequired', () => {
  test('only a 403 with the PASSWORD_CHANGE_REQUIRED code', () => {
    expect(isPasswordChangeRequired(required())).toBe(true);
    expect(isPasswordChangeRequired(httpError(403, { message: 'Access denied' }))).toBe(false);
    expect(isPasswordChangeRequired(httpError(401, { code: 'PASSWORD_CHANGE_REQUIRED' }))).toBe(false);
    expect(isPasswordChangeRequired(httpError(403, '<html>forbidden</html>'))).toBe(false);
    expect(isPasswordChangeRequired(new AxiosError('Network Error', 'ERR_NETWORK'))).toBe(false);
    expect(isPasswordChangeRequired(new Error('x'))).toBe(false);
  });
});

describe('listeners', () => {
  test('are told about a PASSWORD_CHANGE_REQUIRED answer only, until they unsubscribe', () => {
    let calls = 0;
    const unsubscribe = onPasswordChangeRequired(() => calls++);
    expect(reportIfPasswordChangeRequired(httpError(500, {}))).toBe(false);
    expect(calls).toBe(0);
    expect(reportIfPasswordChangeRequired(required())).toBe(true);
    expect(calls).toBe(1);
    unsubscribe();
    reportIfPasswordChangeRequired(required());
    expect(calls).toBe(1);
  });
});

describe('interceptor', () => {
  test('reports the answer and still rejects with the original error', async () => {
    const error = required();
    const adapter: AxiosAdapter = () => Promise.reject(error);
    const instance = axios.create({ adapter });
    installPasswordChangeInterceptor(instance);
    let calls = 0;
    const unsubscribe = onPasswordChangeRequired(() => calls++);
    try {
      await expect(instance.get('/markers')).rejects.toBe(error);
      expect(calls).toBe(1);
      const other = httpError(500, {});
      const failing = axios.create({ adapter: () => Promise.reject(other) });
      installPasswordChangeInterceptor(failing);
      await expect(failing.get('/markers')).rejects.toBe(other);
      expect(calls).toBe(1);
    } finally {
      unsubscribe();
    }
  });
});
