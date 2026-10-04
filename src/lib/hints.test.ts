import { describe, expect, test } from 'bun:test';
import { HINT_WINDOW_MS, hintBoardRefreshMs, remainingMs, hintProgress, hintStep, lastHintRows } from './hints';
import type { HintBoard, HintCell } from '@/types/HintCell';

describe('hint timer', () => {
  const publishAt = '2026-10-17T12:00:00.000Z';
  const start = new Date(publishAt).getTime();

  test('remainingMs counts down from 20 minutes', () => {
    expect(remainingMs(publishAt, start)).toBe(HINT_WINDOW_MS);
    expect(remainingMs(publishAt, start + 60_000)).toBe(HINT_WINDOW_MS - 60_000);
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

describe('hintStep', () => {
  test('open cell is at step 1', () => {
    expect(hintStep({ status: 'open', check: 'unchecked' })).toEqual({ current: 1, done: [] });
  });

  test('none cell reports step 1 (no stepper shown)', () => {
    expect(hintStep({ status: 'none', check: 'unchecked' })).toEqual({ current: 1, done: [] });
  });

  test('solving cell has claimed and is at step 2', () => {
    expect(hintStep({ status: 'solving', check: 'unchecked' })).toEqual({ current: 2, done: [1] });
  });

  test('solved unchecked cell is at step 3', () => {
    expect(hintStep({ status: 'solved', check: 'unchecked' })).toEqual({ current: 3, done: [1, 2], checkState: 'unchecked' });
  });

  test('verified cell has all steps done', () => {
    expect(hintStep({ status: 'solved', check: 'verified' })).toEqual({ current: 3, done: [1, 2, 3], checkState: 'verified' });
  });

  test('disputed cell stays at step 3 with the dispute', () => {
    expect(hintStep({ status: 'solved', check: 'disputed' })).toEqual({ current: 3, done: [1, 2], checkState: 'disputed' });
  });
});

describe('hintBoardRefreshMs', () => {
  test('polls every 3 s while the hints page is open', () => expect(hintBoardRefreshMs(true)).toBe(3000));
  test('polls every 10 s for the sidebar mini grid', () => expect(hintBoardRefreshMs(false)).toBe(10_000));
});
