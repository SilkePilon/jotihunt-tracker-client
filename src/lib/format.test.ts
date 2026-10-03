import { describe, expect, test } from 'bun:test';
import { formatClock, formatCountdown } from './format';

describe('formatClock', () => {
  test('HH:mm in Dutch time, regardless of the device time zone', () => {
    expect(formatClock('2026-10-17T09:17:00Z')).toBe('11:17'); // CEST
    expect(formatClock('2026-12-01T09:05:00Z')).toBe('10:05'); // CET
    expect(formatClock(new Date('2026-10-17T22:00:00Z'))).toBe('00:00');
    expect(formatClock(Date.UTC(2026, 9, 17, 12, 30))).toBe('14:30');
  });
});

describe('formatCountdown', () => {
  test('m:ss, never negative', () => {
    expect(formatCountdown(0)).toBe('0:00');
    expect(formatCountdown(-1000)).toBe('0:00');
    expect(formatCountdown(20 * 60_000)).toBe('20:00');
    expect(formatCountdown(61_000)).toBe('1:01');
    expect(formatCountdown(59 * 60_000 + 59_000)).toBe('59:59');
  });

  test('rounds up to whole seconds', () => {
    expect(formatCountdown(500)).toBe('0:01');
    expect(formatCountdown(60_500)).toBe('1:01');
    expect(formatCountdown(59 * 60_000 + 59_500)).toBe('1:00:00');
  });

  test('h:mm:ss from one hour, Xd Yu from one day', () => {
    expect(formatCountdown(3 * 3_600_000 + 5 * 60_000 + 7_000)).toBe('3:05:07');
    expect(formatCountdown(19 * 86_400_000 + 12 * 3_600_000 + 36 * 60_000)).toBe('19d 12u');
  });
});
