import { describe, expect, test } from 'bun:test';
import { AxiosError, AxiosHeaders } from 'axios';
import { isUnauthorized } from './session';

function httpError(status: number) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, { status, statusText: '', headers: {}, config, data: {} });
}

describe('isUnauthorized', () => {
  test('only a 401 ends the session', () => {
    expect(isUnauthorized(httpError(401))).toBe(true);
  });

  test('server trouble, timeouts and network errors keep the user signed in', () => {
    expect(isUnauthorized(httpError(500))).toBe(false);
    expect(isUnauthorized(httpError(503))).toBe(false);
    expect(isUnauthorized(httpError(403))).toBe(false);
    expect(isUnauthorized(new AxiosError('timeout of 15000ms exceeded', 'ECONNABORTED'))).toBe(false);
    expect(isUnauthorized(new AxiosError('Network Error', 'ERR_NETWORK'))).toBe(false);
    expect(isUnauthorized(new Error('x'))).toBe(false);
  });
});
