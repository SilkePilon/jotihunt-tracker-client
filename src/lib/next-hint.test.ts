import { describe, expect, test } from 'bun:test';
import type { Article } from '@/types/Article';
import { formatHintCountdown, getLastHintTime, getNextHintTime } from './next-hint';

function article(type: string, publishAt: string): Article {
  return { id: 1, title: 't', type, publishAt: new Date(publishAt), content: '', messageType: '', maxPoints: 0, endTime: new Date() };
}

describe('getLastHintTime', () => {
  test('returns the newest hint regardless of order and ignores news', () => {
    const articles = [
      article('hint', '2026-10-17T10:00:00Z'),
      article('news', '2026-10-17T13:00:00Z'),
      article('hint', '2026-10-17T12:00:00Z'),
    ];
    expect(getLastHintTime(articles)?.toISOString()).toBe('2026-10-17T12:00:00.000Z');
  });

  test('undefined without hints', () => {
    expect(getLastHintTime([article('news', '2026-10-17T10:00:00Z')])).toBeUndefined();
    expect(getLastHintTime(undefined)).toBeUndefined();
  });
});

describe('getNextHintTime', () => {
  const start = new Date('2026-10-17T08:00:00Z');

  test('hunt start when there is no hint or the hint is before the start', () => {
    expect(getNextHintTime(undefined, start).toISOString()).toBe(start.toISOString());
    expect(getNextHintTime(new Date('2026-09-21T14:00:00Z'), start).toISOString()).toBe(start.toISOString());
  });

  test('next full hour after the last hint', () => {
    expect(getNextHintTime(new Date('2026-10-17T12:04:30Z'), start).toISOString()).toBe('2026-10-17T13:00:00.000Z');
  });
});

describe('formatHintCountdown', () => {
  test('formats minutes and hours', () => {
    expect(formatHintCountdown(0)).toBe('0:00');
    expect(formatHintCountdown(-1000)).toBe('0:00');
    expect(formatHintCountdown(61_000)).toBe('1:01');
    expect(formatHintCountdown(59 * 60_000 + 59_000)).toBe('59:59');
    expect(formatHintCountdown(3 * 3_600_000 + 5 * 60_000 + 7_000)).toBe('3:05:07');
    expect(formatHintCountdown(19 * 86_400_000 + 12 * 3_600_000 + 36 * 60_000)).toBe('19d 12u');
  });
});
