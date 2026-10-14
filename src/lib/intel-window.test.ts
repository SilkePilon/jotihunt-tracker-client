import { describe, expect, test } from 'bun:test';
import { AxiosError, AxiosHeaders } from 'axios';
import type { Article } from '@/types/Article';
import type { HintCell } from '@/types/HintCell';
import type { IntelItem } from '@/types/Intel';
import { areaStates, buildIntelItems, deadlineLabel, filterByTab, groupByDay, hasExistingMarker, isDeadlineUrgent, nextOpenArea, solvedCount, unreadCount } from './intel-window';

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
});

describe('tabs and unread', () => {
  const items = [{ kind: 'hint', unread: false }, { kind: 'news', unread: true }, { kind: 'assignment', unread: true }] as IntelItem[];
  test('filterByTab', () => {
    expect(filterByTab(items, 'all')).toHaveLength(3);
    expect(filterByTab(items, 'news').map((item) => item.kind)).toEqual(['news']);
  });
  test('unreadCount', () => expect(unreadCount(items)).toBe(2));
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
    expect(deadlineLabel('2026-10-17T11:00:00Z', now)).toBe('verlopen');
  });
  test('urgent under an hour unless done', () => {
    expect(isDeadlineUrgent('2026-10-17T12:30:00Z', now, 'open')).toBe(true);
    expect(isDeadlineUrgent('2026-10-17T12:30:00Z', now, 'submitted')).toBe(false);
    expect(isDeadlineUrgent('2026-10-17T15:00:00Z', now, 'busy')).toBe(false);
  });
});

test('hasExistingMarker', () => {
  const error = new AxiosError('x', '409', undefined, undefined, { status: 409, data: { existingMarkerId: 'm' }, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } });
  expect(hasExistingMarker(error)).toBe(true);
  expect(hasExistingMarker(new Error('x'))).toBe(false);
});
