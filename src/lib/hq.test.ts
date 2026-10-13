import { expect, test } from 'bun:test';
import { openAssignment } from './hq';
import type { Article } from '@/types/Article';

const now = new Date('2026-10-17T19:00:00Z').getTime();
const article = (id: number, type: string, publishAt: string, endTime?: string) => ({ id, type, title: `${id}`, publishAt, endTime }) as unknown as Article;

test('openAssignment picks the newest assignment that is still open', () => {
  expect(openAssignment([article(1, 'assignment', '2026-10-17T18:00:00Z', '2026-10-17T21:00:00Z'), article(2, 'assignment', '2026-10-17T18:30:00Z', '2026-10-17T22:00:00Z')], now)?.id).toBe(2);
  expect(openAssignment([], now)).toBeUndefined();
  expect(openAssignment(undefined, now)).toBeUndefined();
});

test('openAssignment skips news and hints, even with an endTime', () => {
  const articles = [
    article(1, 'assignment', '2026-10-17T17:00:00Z', '2026-10-17T21:00:00Z'),
    article(2, 'news', '2026-10-17T18:00:00Z', '2026-10-17T23:00:00Z'),
    article(3, 'hint', '2026-10-17T18:30:00Z', '2026-10-17T23:00:00Z'),
  ];
  expect(openAssignment(articles, now)?.id).toBe(1);
});

test('openAssignment skips closed assignments and ones without a deadline', () => {
  const articles = [article(1, 'assignment', '2026-10-17T17:00:00Z', '2026-10-17T21:00:00Z'), article(2, 'assignment', '2026-10-17T18:00:00Z', '2026-10-17T18:59:00Z'), article(3, 'assignment', '2026-10-17T18:30:00Z')];
  expect(openAssignment(articles, now)?.id).toBe(1);
});
