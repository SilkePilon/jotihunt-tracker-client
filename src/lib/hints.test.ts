import { describe, expect, test } from 'bun:test';
import { formatCountdown, HINT_WINDOW_MS, remainingMs } from './hints';

describe('hint timer', () => {
  const publishAt = '2026-10-17T12:00:00.000Z';
  const start = new Date(publishAt).getTime();

  test('remainingMs counts down from 20 minutes', () => {
    expect(remainingMs(publishAt, start)).toBe(HINT_WINDOW_MS);
    expect(remainingMs(publishAt, start + 60_000)).toBe(HINT_WINDOW_MS - 60_000);
  });

  test('formatCountdown', () => {
    expect(formatCountdown(20 * 60_000)).toBe('20:00');
    expect(formatCountdown(61_000)).toBe('1:01');
    expect(formatCountdown(500)).toBe('0:01');
    expect(formatCountdown(-5)).toBe('0:00');
  });
});
