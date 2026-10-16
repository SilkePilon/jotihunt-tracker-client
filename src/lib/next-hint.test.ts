import { describe, expect, test } from 'bun:test';
import type { Article } from '@/types/Article';
import { getLastHintTime, getNextHintTime, nextHintLabel, type NextHintState } from './next-hint';

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

describe('nextHintLabel', () => {
  const base: NextHintState = { articlesLoading: false, articlesError: false, isNewHint: false, huntOver: false, hasHuntStart: true, configLoaded: true, countdown: '12:34' };

  test('counts down with a hunt start', () => {
    expect(nextHintLabel(base)).toEqual({ label: '12:34', isCountdown: true });
  });

  test('no hunt start: loading until /config answers, then "Geen hunttijd"', () => {
    expect(nextHintLabel({ ...base, hasHuntStart: false, configLoaded: false })).toEqual({ label: '…', isCountdown: false });
    expect(nextHintLabel({ ...base, hasHuntStart: false })).toEqual({ label: 'Geen hunttijd', isCountdown: false });
  });

  test('a known (persisted) hunt start counts down before /config answers', () => {
    expect(nextHintLabel({ ...base, configLoaded: false })).toEqual({ label: '12:34', isCountdown: true });
  });

  test('loading, error, new hint and hunt over win in that order', () => {
    expect(nextHintLabel({ ...base, articlesLoading: true, articlesError: true }).label).toBe('…');
    expect(nextHintLabel({ ...base, articlesError: true, isNewHint: true }).label).toBe('Fout');
    expect(nextHintLabel({ ...base, isNewHint: true, hasHuntStart: false }).label).toBe('Nieuwe hint!');
    expect(nextHintLabel({ ...base, huntOver: true })).toEqual({ label: 'Geen hints meer', isCountdown: false });
  });
});
