import { describe, expect, test } from 'bun:test';
import { formatClock, formatCountdown, formatDistanceFromMe, joinParts } from './format';

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

describe('formatDistanceFromMe', () => {
  test('hidden when unknown or under 20 m', () => {
    expect(formatDistanceFromMe(undefined)).toBeUndefined();
    expect(formatDistanceFromMe(Number.NaN)).toBeUndefined();
    expect(formatDistanceFromMe(0)).toBeUndefined();
    expect(formatDistanceFromMe(19.9)).toBeUndefined();
  });

  test('metres below 1 km, km with a Dutch comma from 1 km', () => {
    expect(formatDistanceFromMe(20)).toBe('20 m van jou');
    expect(formatDistanceFromMe(349.6)).toBe('350 m van jou');
    expect(formatDistanceFromMe(999)).toBe('999 m van jou');
    expect(formatDistanceFromMe(1000)).toBe('1,0 km van jou');
    expect(formatDistanceFromMe(2449)).toBe('2,4 km van jou');
    expect(formatDistanceFromMe(12_345)).toBe('12,3 km van jou');
  });
});

describe('joinParts', () => {
  test('joins the present parts with a middle dot', () => {
    expect(joinParts('Bravo', undefined, '2,4 km van jou')).toBe('Bravo · 2,4 km van jou');
    expect(joinParts(false, null, '')).toBe('');
    expect(joinParts('alleen')).toBe('alleen');
  });
});
