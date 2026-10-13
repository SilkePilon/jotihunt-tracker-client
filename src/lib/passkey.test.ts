import { describe, expect, test } from 'bun:test';
import { AxiosError, AxiosHeaders } from 'axios';
import { classifyPasskeyError, PASSKEY_MESSAGES } from './passkey';

function httpError(status: number | undefined, data: unknown = {}) {
  const error = new AxiosError('fail');
  if (status !== undefined) error.response = { status, data, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } };
  return error;
}

describe('classifyPasskeyError', () => {
  test('browser ceremony errors', () => {
    expect(classifyPasskeyError(Object.assign(new Error('x'), { name: 'NotAllowedError' }))).toBe('cancelled');
    expect(classifyPasskeyError(Object.assign(new Error('x'), { name: 'AbortError' }))).toBe('cancelled');
    expect(classifyPasskeyError(Object.assign(new Error('x'), { name: 'NotSupportedError' }))).toBe('unsupported');
    // @simplewebauthn wraps the DOMException in `cause`
    expect(classifyPasskeyError(Object.assign(new Error('x'), { name: 'WebAuthnError', cause: { name: 'NotAllowedError' } }))).toBe('cancelled');
  });

  test('server answers', () => {
    expect(classifyPasskeyError(httpError(undefined))).toBe('offline');
    expect(classifyPasskeyError(httpError(503))).toBe('offline');
    expect(classifyPasskeyError(httpError(429))).toBe('rate-limited');
    expect(classifyPasskeyError(httpError(401, { code: 'UNKNOWN_PASSKEY' }))).toBe('unknown-passkey');
    expect(classifyPasskeyError(httpError(400, { code: 'CHALLENGE_EXPIRED' }))).toBe('expired');
    expect(classifyPasskeyError(httpError(410, { reason: 'full' }))).toBe('invite-gone');
    expect(classifyPasskeyError(httpError(410, { message: 'Deze herstel-link werkt niet meer.' }))).toBe('link-gone');
    expect(classifyPasskeyError(httpError(401, { code: 'PASSKEY_FAILED' }))).toBe('failed');
  });

  test('every failure has Dutch copy without raw error names', () => {
    for (const message of Object.values(PASSKEY_MESSAGES)) {
      expect(message.length).toBeGreaterThan(10);
      expect(message).not.toMatch(/Error/);
    }
  });
});
