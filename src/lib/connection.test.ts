import { describe, expect, test } from 'bun:test';
import { staleAge, staleLabel } from './connection';

const NOW = 1_000_000_000;

describe('staleAge', () => {
  test('recent data is never stale', () => {
    expect(staleAge({ lastSuccessAt: NOW - 30_000, lastErrorAt: NOW - 1000 }, false, NOW)).toBeNull();
  });

  test('old data is stale after a failure since the last success', () => {
    expect(staleAge({ lastSuccessAt: NOW - 90_000, lastErrorAt: NOW - 5000 }, true, NOW)).toBe(90_000);
  });

  test('old data is stale while offline, even without a failed fetch', () => {
    expect(staleAge({ lastSuccessAt: NOW - 90_000, lastErrorAt: null }, false, NOW)).toBe(90_000);
  });

  test('old data without a failure (tab back from the background, not polled yet) is not flagged', () => {
    expect(staleAge({ lastSuccessAt: NOW - 600_000, lastErrorAt: null }, true, NOW)).toBeNull();
    expect(staleAge({ lastSuccessAt: NOW - 600_000, lastErrorAt: NOW - 700_000 }, true, NOW)).toBeNull();
  });
});

describe('staleLabel', () => {
  test('minutes, then hours', () => {
    expect(staleLabel(61_000)).toBe('Geen verbinding — gegevens 1 min oud');
    expect(staleLabel(3 * 60_000 + 5000)).toBe('Geen verbinding — gegevens 3 min oud');
    expect(staleLabel(125 * 60_000)).toBe('Geen verbinding — gegevens 2 u 5 min oud');
  });
});
