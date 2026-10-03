import { describe, expect, test } from 'bun:test';
import { AxiosError, AxiosHeaders } from 'axios';
import { isUnauthorized, markTokenReplaced } from './session';

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

describe('a token replaced by a fresh one', () => {
  function unauthorizedWith(authorization: string) {
    const config = { headers: new AxiosHeaders({ Authorization: authorization }) };
    return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, { status: 401, statusText: '', headers: {}, config, data: {} });
  }

  test('a 401 for a request still sent with the replaced token does not end the session', () => {
    expect(isUnauthorized(unauthorizedWith('Bearer old-token'))).toBe(true);
    markTokenReplaced('Bearer old-token');
    expect(isUnauthorized(unauthorizedWith('Bearer old-token'))).toBe(false);
    expect(isUnauthorized(unauthorizedWith('Bearer new-token'))).toBe(true);
  });
});
