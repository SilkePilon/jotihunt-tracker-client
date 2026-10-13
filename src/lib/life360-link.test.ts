import { expect, test } from 'bun:test';
import { isSixDigits, resendCountdown } from './life360';

const NOW = Date.parse('2026-10-17T12:00:00Z');

test('resendCountdown: m:ss until resendAt, null from then on (and for a bad time)', () => {
  expect(resendCountdown(new Date(NOW + 42_000).toISOString(), NOW)).toBe('0:42');
  expect(resendCountdown(new Date(NOW + 61_500).toISOString(), NOW)).toBe('1:02');
  expect(resendCountdown(new Date(NOW).toISOString(), NOW)).toBeNull();
  expect(resendCountdown(new Date(NOW - 5000).toISOString(), NOW)).toBeNull();
  expect(resendCountdown('garbage', NOW)).toBeNull();
});

test('isSixDigits: exactly six digits', () => {
  expect(isSixDigits('048172')).toBe(true);
  expect(isSixDigits('04817')).toBe(false);
  expect(isSixDigits('04817a')).toBe(false);
  expect(isSixDigits(' 048172')).toBe(false);
  expect(isSixDigits('0481723')).toBe(false);
});
