import { expect, test } from 'bun:test';
import { latestNonHintArticle } from './hq';
import type { Article } from '@/types/Article';

test('latestNonHintArticle skips hints', () => {
  const article = (id: number, type: string, publishAt: string) => ({ id, type, title: `${id}`, publishAt }) as unknown as Article;
  expect(latestNonHintArticle([article(1, 'news', '2026-10-17T18:00:00Z'), article(2, 'hint', '2026-10-17T19:00:00Z'), article(3, 'assignment', '2026-10-17T18:30:00Z')])?.id).toBe(3);
  expect(latestNonHintArticle([])).toBeUndefined();
});
