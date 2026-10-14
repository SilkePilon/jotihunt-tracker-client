import { describe, expect, test } from 'bun:test';
import { AxiosError, AxiosHeaders } from 'axios';
import { canRetryConfirm, nextAfterLogin, panelAfterPoll, qrProblem, QR_RENEW_FOR_MS } from './qr-login';

function httpError(status: number, data: unknown = {}) {
  const error = new AxiosError('fail');
  error.response = { status, data, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } };
  return error;
}

const url = 'https://jotihunt.test/l/abc';
const expiresAt = '2026-10-17T12:02:00.000Z';

describe('panelAfterPoll', () => {
  test('waiting and scanned keep showing the code', () => {
    expect(panelAfterPoll({ status: 'waiting', expiresAt }, url, 0, 1000)).toEqual({ phase: 'waiting', url, expiresAt: Date.parse(expiresAt) });
    expect(panelAfterPoll({ status: 'scanned', scannedBy: { name: 'Jesse' }, expiresAt }, url, 0, 1000)).toEqual({ phase: 'scanned', url, name: 'Jesse' });
  });

  test('expired, denied or gone: a new code within 10 minutes, after that wait for a click', () => {
    expect(panelAfterPoll({ status: 'expired', expiresAt }, url, 0, QR_RENEW_FOR_MS - 1)).toBe('renew');
    expect(panelAfterPoll({ status: 'denied', expiresAt }, url, 0, 1000)).toBe('renew');
    expect(panelAfterPoll('gone', url, 0, 1000)).toBe('renew');
    expect(panelAfterPoll({ status: 'expired', expiresAt }, url, 0, QR_RENEW_FOR_MS)).toEqual({ phase: 'expired' });
  });
});

describe('nextAfterLogin', () => {
  test('only back to a QR confirm link, never anywhere else', () => {
    expect(nextAfterLogin('/l/abc_DEF-123')).toBe('/l/abc_DEF-123');
    expect(nextAfterLogin(null)).toBe('/');
    expect(nextAfterLogin('https://evil.example/l/abc')).toBe('/');
    expect(nextAfterLogin('//evil.example')).toBe('/');
    expect(nextAfterLogin('/l/abc/../../users')).toBe('/');
    expect(nextAfterLogin('/users')).toBe('/');
  });
});

describe('qrProblem', () => {
  test('server answers about the code', () => {
    expect(qrProblem(httpError(404, { code: 'QR_GONE' }))).toEqual({ message: 'Deze code werkt niet meer. Vernieuw de code op het andere apparaat.', addPasskey: false });
    expect(qrProblem(httpError(409, { code: 'QR_TAKEN' }))).toEqual({ message: 'Iemand anders heeft deze code al gescand.', addPasskey: false });
    expect(qrProblem(httpError(409, { code: 'NO_PASSKEY' }))).toEqual({ message: 'Je hebt nog geen passkey. Voeg er een toe en scan de code opnieuw.', addPasskey: true });
  });

  test('everything else uses the passkey messages', () => {
    expect(qrProblem(httpError(401, { code: 'PASSKEY_FAILED' })).message).toBe('Er ging iets mis, probeer het opnieuw.');
    expect(qrProblem(Object.assign(new Error('x'), { name: 'NotAllowedError' })).message).toBe('Niet afgerond. Probeer het opnieuw.');
    expect(qrProblem(new AxiosError('offline')).message).toBe('Kan de server niet bereiken, controleer je verbinding.');
  });
});

describe('canRetryConfirm', () => {
  test('a cancelled prompt or a passkey that did not match can be tried again', () => {
    expect(canRetryConfirm(Object.assign(new Error('x'), { name: 'NotAllowedError' }))).toBe(true);
    expect(canRetryConfirm(httpError(401, { code: 'PASSKEY_FAILED' }))).toBe(true);
  });

  test('a gone code, other 401s and network errors go to the problem view', () => {
    expect(canRetryConfirm(httpError(404, { code: 'QR_GONE' }))).toBe(false);
    expect(canRetryConfirm(httpError(401))).toBe(false);
    expect(canRetryConfirm(new AxiosError('offline'))).toBe(false);
  });
});
