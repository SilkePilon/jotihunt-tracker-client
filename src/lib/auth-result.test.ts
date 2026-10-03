import { describe, expect, test } from 'bun:test';
import { loginFailure, passwordUpdateFailure } from './auth-result';

describe('loginFailure', () => {
  test('a wrong password or bad request is invalid', () => {
    expect(loginFailure(401)).toBe('invalid');
    expect(loginFailure(400)).toBe('invalid');
  });

  test('429 is rate limited', () => {
    expect(loginFailure(429)).toBe('rate-limited');
  });

  test('server trouble, timeouts and network errors are offline, not a wrong password', () => {
    expect(loginFailure(500)).toBe('offline');
    expect(loginFailure(502)).toBe('offline');
    expect(loginFailure(503)).toBe('offline');
    expect(loginFailure(504)).toBe('offline');
    expect(loginFailure(undefined)).toBe('offline');
  });
});

describe('passwordUpdateFailure', () => {
  test('only 400/401 mean a wrong old password', () => {
    expect(passwordUpdateFailure(401)).toBe('wrong-password');
    expect(passwordUpdateFailure(400)).toBe('wrong-password');
  });

  test('anything else is a general failure', () => {
    expect(passwordUpdateFailure(429)).toBe('failed');
    expect(passwordUpdateFailure(500)).toBe('failed');
    expect(passwordUpdateFailure(503)).toBe('failed');
    expect(passwordUpdateFailure(undefined)).toBe('failed');
  });
});
