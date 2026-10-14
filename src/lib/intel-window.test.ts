import { describe, expect, test } from 'bun:test';
import { AxiosError, AxiosHeaders } from 'axios';
import type { Article } from '@/types/Article';
import type { HintCell } from '@/types/HintCell';
import type { IntelItem } from '@/types/Intel';
import { answerPreview, areaStates, initialOpenArea, buildIntelItems, deadlineLabel, deadlineTone, filterByTab, groupByDay, hasExistingMarker, isDeadlineUrgent, nextOpenArea, solvedCount, unreadCount } from './intel-window';

const article = (id: number, type: string, publishAt: string, extra: Partial<Article> = {}) =>
  ({ id, title: `A${id}`, type, publishAt: new Date(publishAt), content: '<p>x</p>', messageType: '', maxPoints: 0, endTime: new Date(publishAt), ...extra }) as Article;
const cell = (area: string, status: HintCell['status'], articleId = 1): HintCell =>
  ({ _id: `${articleId}-${area}`, articleId, area, publishAt: '', slotTime: '', status, articleChanged: false }) as HintCell;

describe('buildIntelItems', () => {
  test('newest first, kinds, cells per hint, read state and assignment joined', () => {
    const items = buildIntelItems({
      articles: [article(1, 'hint', '2026-10-17T12:00:00Z'), article(2, 'news', '2026-10-17T13:00:00Z'), article(3, 'assignment', '2026-10-16T14:00:00Z', { maxPoints: 30 })],
      board: { articles: [], cells: [cell('alpha', 'solved'), cell('bravo', 'open', 9)] },
      assignments: [{ _id: 'x', articleId: 3, status: 'busy', notes: [] }],
      readState: { read: [2], readBy: { '2': ['Daan', 'Sanne'] } },
    });
    expect(items.map((item) => [item.id, item.kind])).toEqual([[2, 'news'], [1, 'hint'], [3, 'assignment']]);
    expect(items[1].cells.map((c) => c.area)).toEqual(['alpha']);
    expect(items[0]).toMatchObject({ unread: false, readBy: ['Daan', 'Sanne'] });
    expect(items[2]).toMatchObject({ unread: true, maxPoints: 30, assignment: { status: 'busy' } });
    expect(items[1].unread).toBe(false); // hints are never unread
  });
  test('an older server sending a read count instead of names gives no names', () => {
    const readState = { read: [1], readBy: { '1': 3 } } as unknown as Parameters<typeof buildIntelItems>[0]['readState'];
    const [item] = buildIntelItems({ articles: [article(1, 'news', '2026-10-17T12:00:00Z')], readState });
    expect(item.readBy).toEqual([]);
    expect(buildIntelItems({ articles: [article(1, 'news', '2026-10-17T12:00:00Z')], readState: { read: [] } as never })[0].readBy).toEqual([]);
  });
});

describe('tabs and unread', () => {
  const items = [{ kind: 'hint', unread: false }, { kind: 'news', unread: true }, { kind: 'assignment', unread: true }] as IntelItem[];
  test('filterByTab', () => {
    expect(filterByTab(items, 'all')).toHaveLength(3);
    expect(filterByTab(items, 'news').map((item) => item.kind)).toEqual(['news']);
  });
  test('unreadCount', () => {
    expect(unreadCount(items)).toBe(2);
    expect(unreadCount(items, 'news')).toBe(1);
    expect(unreadCount(items, 'hint')).toBe(0);
  });
});

describe('groupByDay', () => {
  const now = new Date('2026-10-17T14:30:00Z').getTime();
  const at = (iso: string) => ({ publishAt: iso }) as IntelItem;
  test('Dutch days, today and yesterday named, order kept', () => {
    const groups = groupByDay([at('2026-10-17T21:59:00Z'), at('2026-10-17T08:00:00Z'), at('2026-10-16T12:00:00Z'), at('2026-10-14T12:00:00Z')], now);
    expect(groups.map((group) => [group.label, group.items.length])).toEqual([
      ['Vandaag · zaterdag 17 okt', 2],
      ['Gisteren · vrijdag 16 okt', 1],
      ['woensdag 14 okt', 1],
    ]);
  });
  test('midnight in Dutch time starts a new day (22:30Z on the 17th is Sunday 18th)', () => {
    expect(groupByDay([at('2026-10-17T22:30:00Z')], now)[0].label).toBe('zondag 18 okt');
  });
});

describe('areas', () => {
  const cells = [cell('alpha', 'solved'), cell('bravo', 'open'), cell('charlie', 'none'), cell('delta', 'open'), cell('oscar', 'open')];
  test('areaStates covers every area in order, missing ones too', () => {
    const states = areaStates(cells);
    expect(Object.keys(states)).toEqual(['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'oscar']);
    expect(states).toMatchObject({ alpha: 'solved', bravo: 'open', charlie: 'none', echo: 'missing' });
  });
  test('solvedCount ignores none', () => expect(solvedCount(cells)).toEqual({ solved: 1, total: 4 }));
  test('nextOpenArea: first open, after a given area with wrap-around, null when none', () => {
    expect(nextOpenArea(cells)).toBe('bravo');
    expect(nextOpenArea(cells, 'bravo')).toBe('delta');
    expect(nextOpenArea(cells, 'oscar')).toBe('bravo');
    expect(nextOpenArea([cell('alpha', 'solved')])).toBeNull();
  });
});

describe('deadlines', () => {
  const now = new Date('2026-10-17T12:00:00Z').getTime();
  test('labels', () => {
    expect(deadlineLabel('2026-10-17T12:42:00Z', now)).toBe('nog 42 min');
    expect(deadlineLabel('2026-10-17T13:47:00Z', now)).toBe('nog 1 u 47');
    expect(deadlineLabel('2026-10-17T13:05:00Z', now)).toBe('nog 1 u 05');
    expect(deadlineLabel('2026-10-17T13:00:00Z', now)).toBe('nog 1 u 00');
    expect(deadlineLabel('2026-10-17T11:00:00Z', now)).toBe('verlopen');
  });
  test('urgent under an hour unless done', () => {
    expect(isDeadlineUrgent('2026-10-17T12:30:00Z', now, 'open')).toBe(true);
    expect(isDeadlineUrgent('2026-10-17T12:30:00Z', now, 'submitted')).toBe(false);
    expect(isDeadlineUrgent('2026-10-17T15:00:00Z', now, 'busy')).toBe(false);
  });
  test('tone', () => {
    expect(deadlineTone('2026-10-17T12:30:00Z', now, 'submitted')).toBe('done');
    expect(deadlineTone('2026-10-17T11:00:00Z', now, 'skipped')).toBe('done');
    expect(deadlineTone('2026-10-17T11:00:00Z', now, 'open')).toBe('expired');
    expect(deadlineTone('2026-10-17T12:30:00Z', now, 'busy')).toBe('urgent');
    expect(deadlineTone('2026-10-17T15:00:00Z', now, 'open')).toBe('calm');
  });
});

test('hasExistingMarker', () => {
  const error = new AxiosError('x', '409', undefined, undefined, { status: 409, data: { existingMarkerId: 'm' }, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } });
  expect(hasExistingMarker(error)).toBe(true);
  expect(hasExistingMarker(new Error('x'))).toBe(false);
});

describe('answerPreview', () => {
  const rd = (x: number, y: number) => ({ x, y, lng: 5.1, lat: 52.1 });
  test('empty answer shows nothing', () => {
    expect(answerPreview('  ', null)).toBeNull();
    expect(answerPreview('', rd(150000, 450000))).toBeNull();
  });
  test('no coordinate is a text answer', () => {
    expect(answerPreview('de kerk', null)).toEqual({ kind: 'text' });
    expect(answerPreview('123 4567', null)).toEqual({ kind: 'text' });
    expect(answerPreview('12345678', null)).toEqual({ kind: 'text' });
    expect(answerPreview('1234 5678 9', null)).toEqual({ kind: 'text' });
  });
  test('two digit groups the server refuses (swapped) are an invalid coordinate', () => {
    expect(answerPreview('4512 1873', null)).toEqual({ kind: 'invalid' });
    expect(answerPreview(' 451200, 187300 ', null)).toEqual({ kind: 'invalid' });
    expect(answerPreview('45120/18730', null)).toEqual({ kind: 'invalid' });
  });
  test('a coordinate inside the game area', () => expect(answerPreview('1500 4500', rd(150000, 450000))).toEqual({ kind: 'rd', rd: rd(150000, 450000) }));
  test('the box edges are inside', () => {
    expect(answerPreview('x', rd(130000, 400000))?.kind).toBe('rd');
    expect(answerPreview('x', rd(260000, 520000))?.kind).toBe('rd');
  });
  test('outside the game area (swapped digits)', () => {
    expect(answerPreview('4500 1500', rd(450000, 150000))?.kind).toBe('outside');
    expect(answerPreview('x', rd(129999, 450000))?.kind).toBe('outside');
    expect(answerPreview('x', rd(150000, 520001))?.kind).toBe('outside');
  });
});

describe('initialOpenArea', () => {
  const cells = [cell('alpha', 'solved'), cell('bravo', 'none'), cell('charlie', 'open'), cell('delta', 'open')];
  test('the requested area when it has a hint (open or solved)', () => {
    expect(initialOpenArea(cells, 'delta')).toBe('delta');
    expect(initialOpenArea(cells, 'alpha')).toBe('alpha');
  });
  test('a none or missing area falls back to the first open one', () => {
    expect(initialOpenArea(cells, 'bravo')).toBe('charlie');
    expect(initialOpenArea(cells, 'oscar')).toBe('charlie');
    expect(initialOpenArea(cells, null)).toBe('charlie');
  });
  test('nothing open and nothing requested: none', () => expect(initialOpenArea([cell('alpha', 'solved')], null)).toBeNull());
});
