import { describe, expect, test } from 'bun:test';
import { AxiosError, type AxiosResponse } from 'axios';
import type { Article } from '@/types/Article';
import type { HintBoard, HintCell } from '@/types/HintCell';
import type { Assignment, IntelItem, PresenceEntry } from '@/types/Intel';
import {
  ASSIGNMENT_STATUS_LABELS,
  buildIntelItems,
  conflictOf,
  conflictText,
  deadlineLabel,
  deadlineTone,
  distanceMeters,
  filterIntelItems,
  hasExistingMarker,
  intelCounts,
  isOpenItem,
  nextWriteStep,
  othersOnItem,
  parseSelection,
  selectionSearch,
} from './intel';

const article = (id: number, type: string, extra: Partial<Article> = {}): Article =>
  ({ id, title: `Titel ${id}`, type, publishAt: `2026-10-17T1${id}:00:00.000Z`, content: `<div>Tekst <strong>${id}</strong></div>`, ...extra }) as unknown as Article;

const cell = (articleId: number, area: string, status: HintCell['status']): HintCell =>
  ({ _id: `${articleId}-${area}`, articleId, area, publishAt: '', slotTime: '', status, check: 'unchecked', notes: [], articleChanged: false }) as HintCell;

const board: HintBoard = { articles: [], cells: [cell(1, 'alpha', 'solved'), cell(1, 'bravo', 'solving'), cell(1, 'charlie', 'none'), cell(9, 'alpha', 'open')] };

const assignment: Assignment = { _id: 'a', articleId: 2, status: 'busy', owner: { _id: 'u1', name: 'Sanne' }, notes: [] };

function items(): IntelItem[] {
  return buildIntelItems({
    articles: [article(1, 'hint'), article(2, 'assignment', { endTime: '2026-10-17T15:30:00.000Z' as unknown as Date, maxPoints: 30, summary: 'Bouw een doedelzak', summaryPoints: ['filmpje'] }), article(3, 'news'), article(4, 'news')],
    board,
    assignments: [assignment],
    readState: { read: [3], readBy: { '3': 4 } },
  });
}

function axios409(data: unknown) {
  return new AxiosError('conflict', '409', undefined, undefined, { status: 409, data } as AxiosResponse);
}

describe('buildIntelItems', () => {
  test('newest first, typed, with cells, assignment, summary and read state', () => {
    const list = items();
    expect(list.map((item) => item.id)).toEqual([4, 3, 2, 1]);
    const [news4, news3, opdracht, hint] = list;
    expect(hint.type).toBe('hint');
    expect(hint.cells.map((entry) => entry.area)).toEqual(['alpha', 'bravo', 'charlie']);
    expect(hint.unread).toBe(false);
    expect(opdracht).toMatchObject({ type: 'assignment', endTime: '2026-10-17T15:30:00.000Z', maxPoints: 30, summary: 'Bouw een doedelzak', summaryPoints: ['filmpje'], unread: true });
    expect(opdracht.assignment).toBe(assignment);
    expect(news3).toMatchObject({ type: 'news', unread: false, readBy: 4, summaryPoints: [] });
    expect(news4).toMatchObject({ unread: true, readBy: 0 });
  });

  test('an unknown article type counts as news; missing inputs give an empty list or bare items', () => {
    expect(buildIntelItems({ articles: [article(5, 'video')] })[0]).toMatchObject({ type: 'news', cells: [], unread: true });
    expect(buildIntelItems({})).toEqual([]);
  });
});

describe('isOpenItem, intelCounts, filterIntelItems', () => {
  test('open: a hint with unsolved cells, an assignment that is open or busy, unread news', () => {
    const [news4, news3, opdracht, hint] = items();
    expect(isOpenItem(hint)).toBe(true);
    expect(isOpenItem({ ...hint, cells: [cell(1, 'alpha', 'solved'), cell(1, 'bravo', 'none')] })).toBe(false);
    expect(isOpenItem(opdracht)).toBe(true);
    expect(isOpenItem({ ...opdracht, assignment: { ...assignment, status: 'submitted' } })).toBe(false);
    expect(isOpenItem({ ...opdracht, assignment: undefined })).toBe(true);
    expect(isOpenItem(news4)).toBe(true);
    expect(isOpenItem(news3)).toBe(false);
  });

  test('open: a hint whose cells are not there yet (the board still loads)', () => {
    const hint = buildIntelItems({ articles: [article(1, 'hint')] })[0];
    expect(hint.cells).toEqual([]);
    expect(isOpenItem(hint)).toBe(true);
  });

  test('counts per type', () => {
    expect(intelCounts(items())).toEqual({ all: 4, hint: 1, assignment: 1, news: 2 });
  });

  test('filters by type, by open, and by words in title or text (tags ignored, case-insensitive)', () => {
    const list = items();
    expect(filterIntelItems(list, { type: 'news', query: '', openOnly: false }).map((item) => item.id)).toEqual([4, 3]);
    expect(filterIntelItems(list, { type: 'all', query: '', openOnly: true }).map((item) => item.id)).toEqual([4, 2, 1]);
    expect(filterIntelItems(list, { type: 'all', query: 'TITEL 3', openOnly: false }).map((item) => item.id)).toEqual([3]);
    expect(filterIntelItems(list, { type: 'all', query: 'tekst 2', openOnly: false }).map((item) => item.id)).toEqual([2]);
    expect(filterIntelItems(list, { type: 'all', query: 'strong', openOnly: false })).toEqual([]);
    expect(filterIntelItems(list, { type: 'all', query: '  ', openOnly: false })).toHaveLength(4);
  });

  test('search also looks in the summary, and repeated spaces in the query count as one', () => {
    const list = items();
    expect(filterIntelItems(list, { type: 'all', query: 'doedelzak', openOnly: false }).map((item) => item.id)).toEqual([2]);
    expect(filterIntelItems(list, { type: 'all', query: 'tekst   2', openOnly: false }).map((item) => item.id)).toEqual([2]);
    expect(filterIntelItems(list, { type: 'all', query: ' bouw  een\tdoedelzak ', openOnly: false }).map((item) => item.id)).toEqual([2]);
  });
});

describe('deadline', () => {
  const end = '2026-10-17T15:30:00.000Z';
  const at = (iso: string) => new Date(iso).getTime();

  test('tone: done when handed in or skipped, late after the deadline, urgent within the hour, else soon', () => {
    expect(deadlineTone(end, at('2026-10-17T14:00:00Z'), 'open')).toBe('soon');
    expect(deadlineTone(end, at('2026-10-17T14:31:00Z'), 'busy')).toBe('urgent');
    expect(deadlineTone(end, at('2026-10-17T15:30:00Z'), 'busy')).toBe('late');
    expect(deadlineTone(end, at('2026-10-17T16:00:00Z'), 'submitted')).toBe('done');
    expect(deadlineTone(end, at('2026-10-17T14:00:00Z'), 'skipped')).toBe('done');
    expect(deadlineTone(undefined, at('2026-10-17T14:00:00Z'), 'open')).toBe('none');
  });

  test('label', () => {
    expect(deadlineLabel(end, at('2026-10-17T14:48:00Z'))).toBe('nog 42 min');
    expect(deadlineLabel(end, at('2026-10-17T13:43:00Z'))).toBe('nog 1 u 47');
    expect(deadlineLabel(end, at('2026-10-17T15:29:30Z'))).toBe('nog 1 min');
    expect(deadlineLabel(end, at('2026-10-17T15:30:00Z'))).toBe('verlopen');
    expect(deadlineLabel('2026-10-18T15:30:00.000Z', at('2026-10-17T13:30:00Z'))).toBe('nog 26 u 0');
  });

  test('status labels', () => {
    expect(ASSIGNMENT_STATUS_LABELS).toEqual({ open: 'Open', busy: 'Bezig', submitted: 'Ingeleverd', skipped: 'Skip' });
  });
});

describe('othersOnItem', () => {
  const entries: PresenceEntry[] = [
    { userId: 'me', name: 'Ik', itemId: 1, area: 'alpha', at: 1 },
    { userId: 'u1', name: 'Sanne', itemId: 1, area: 'alpha', at: 2 },
    { userId: 'u2', name: 'Daan', itemId: 1, area: 'bravo', at: 3 },
    { userId: 'u3', name: 'Noor', itemId: 2, at: 4 },
  ];

  test('everyone else on the item; with an area only those on that area', () => {
    expect(othersOnItem(entries, 1, 'me').map((entry) => entry.name)).toEqual(['Sanne', 'Daan']);
    expect(othersOnItem(entries, 1, 'me', 'alpha').map((entry) => entry.name)).toEqual(['Sanne']);
    expect(othersOnItem(entries, 2, 'me').map((entry) => entry.name)).toEqual(['Noor']);
    expect(othersOnItem(undefined, 1, 'me')).toEqual([]);
  });
});

describe('write conflicts', () => {
  const conflict = { kind: 'answer', value: '189732 445126', by: { _id: 'u1', name: 'Sanne' }, at: '2026-10-17T12:06:00.000Z' };

  test('conflictOf reads the conflict of a 409; anything else is null', () => {
    expect(conflictOf(axios409({ message: 'x', conflict }))).toEqual(conflict as never);
    expect(conflictOf(axios409({ message: 'x' }))).toBeNull();
    expect(conflictOf(new Error('boom'))).toBeNull();
  });

  test('hasExistingMarker', () => {
    expect(hasExistingMarker(axios409({ existingMarkerId: 'm1' }))).toBe(true);
    expect(hasExistingMarker(axios409({ conflict }))).toBe(false);
  });

  test('nextWriteStep: a conflict asks with overwrite, an existing marker asks with replaceMarker, else it is an error', () => {
    const flags = { overwrite: false, replaceMarker: false };
    expect(nextWriteStep(axios409({ conflict }), flags)).toEqual({ ask: 'conflict', conflict: conflict as never, flags: { overwrite: true, replaceMarker: false } });
    expect(nextWriteStep(axios409({ existingMarkerId: 'm1' }), { overwrite: true, replaceMarker: false })).toEqual({ ask: 'marker', conflict: null, flags: { overwrite: true, replaceMarker: true } });
    expect(nextWriteStep(new Error('boom'), flags)).toEqual({ ask: 'error' });
    // Already overwriting and still a conflict: not asked again in a loop
    expect(nextWriteStep(axios409({ conflict }), { overwrite: true, replaceMarker: false })).toEqual({ ask: 'error' });
  });

  test('conflictText per kind', () => {
    expect(conflictText({ ...conflict, kind: 'answer' } as never)).toEqual({ title: 'Antwoord overschrijven?', description: 'Sanne heeft dit vak al opgelost.', confirm: 'Overschrijven' });
    expect(conflictText({ ...conflict, kind: 'claim', value: null } as never)).toEqual({ title: 'Vak overnemen?', description: 'Sanne is met dit vak bezig.', confirm: 'Overnemen' });
    expect(conflictText({ ...conflict, kind: 'status' } as never).title).toBe('Status overschrijven?');
    expect(conflictText({ ...conflict, kind: 'owner' } as never).title).toBe('Opdracht overnemen?');
    expect(conflictText({ ...conflict, by: null } as never).description).toBe('Iemand anders heeft dit vak al opgelost.');
  });
});

describe('distanceMeters', () => {
  test('about 300 m between two points 300 m apart, 0 for the same point', () => {
    expect(distanceMeters([5.9, 52.0], [5.9, 52.0])).toBe(0);
    const meters = distanceMeters([5.9, 52.0], [5.9, 52.0027]);
    expect(meters).toBeGreaterThan(290);
    expect(meters).toBeLessThan(310);
  });
});

describe('selection in the URL', () => {
  test('parseSelection reads item and area, and the old article parameter', () => {
    expect(parseSelection(new URLSearchParams('item=12&area=Charlie'))).toEqual({ itemId: 12, area: 'charlie' });
    expect(parseSelection(new URLSearchParams('article=7&area=alpha'))).toEqual({ itemId: 7, area: 'alpha' });
    expect(parseSelection(new URLSearchParams('item=abc'))).toEqual({});
    expect(parseSelection(new URLSearchParams(''))).toEqual({});
  });

  test('selectionSearch builds the query string', () => {
    expect(selectionSearch(12, 'charlie')).toBe('?item=12&area=charlie');
    expect(selectionSearch(12)).toBe('?item=12');
    expect(selectionSearch()).toBe('');
  });
});
