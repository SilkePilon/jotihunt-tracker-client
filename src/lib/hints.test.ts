import { describe, expect, test } from 'bun:test';
import { formatCountdown, HINT_WINDOW_MS, remainingMs, hintProgress, lastHintRows } from './hints';
import type { HintBoard, HintCell } from '@/types/HintCell';

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

function cell(articleId: number, area: string, status: HintCell['status']): HintCell {
  return {
    _id: `${articleId}-${area}`, articleId, area, publishAt: '', slotTime: '', status,
    check: 'unchecked', notes: [], articleChanged: false,
  };
}

describe('lastHintRows', () => {
  const board: HintBoard = {
    articles: [
      { id: 1, title: 'a', publishAt: '2026-10-17T10:00:00Z', content: '' },
      { id: 3, title: 'c', publishAt: '2026-10-17T12:00:00Z', content: '' },
      { id: 2, title: 'b', publishAt: '2026-10-17T11:00:00Z', content: '' },
    ],
    cells: [cell(3, 'alpha', 'solved'), cell(3, 'bravo', 'none'), cell(2, 'alpha', 'open')],
  };

  test('newest first, limited to count', () => {
    expect(lastHintRows(board, 2).map((row) => row.article.id)).toEqual([3, 2]);
    expect(lastHintRows(board, 10)).toHaveLength(3);
  });

  test('maps cells by area', () => {
    const [newest] = lastHintRows(board, 1);
    expect(newest.cells.alpha?.status).toBe('solved');
    expect(newest.cells.bravo?.status).toBe('none');
    expect(newest.cells.charlie).toBeUndefined();
  });

  test('hintProgress ignores none cells', () => {
    expect(hintProgress(board)).toEqual({ solved: 1, total: 2 });
  });
});
