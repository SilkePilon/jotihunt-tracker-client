import { describe, expect, test } from 'bun:test';
import { hintBoardRefreshMs, hintProgress, lastHintRows } from './hints';
import type { HintBoard, HintCell } from '@/types/HintCell';

function cell(articleId: number, area: string, status: HintCell['status']): HintCell {
  return {
    _id: `${articleId}-${area}`, articleId, area, publishAt: '', slotTime: '', status,
    articleChanged: false,
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

describe('hintBoardRefreshMs', () => {
  test('polls every 3 s while the intel window is open', () => expect(hintBoardRefreshMs(true)).toBe(3000));
  test('polls every 10 s for the sidebar mini grid', () => expect(hintBoardRefreshMs(false)).toBe(10_000));
});
