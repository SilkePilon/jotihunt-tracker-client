import { describe, expect, test } from 'bun:test';
import { AxiosError, AxiosHeaders } from 'axios';
import type { Article } from '@/types/Article';
import type { HintCell } from '@/types/HintCell';
import type { Assignment, IntelItem } from '@/types/Intel';
import { answerPreview, areaStates, assignmentStatusLabel, earnedPoints, chartColumns, initialOpenArea, buildIntelItems, deadlineLabel, deadlineTone, filterByTab, formatSolveTime, groupByDay, hasExistingMarker, intelStats, isDeadlineUrgent, nextOpenArea, ratingStars, siteSubmission, solvedCount, statusAuthor, unreadCount, unreadLabel, unreadTab } from './intel-window';

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
  test('the requested area when it has a cell (open, solved or none)', () => {
    expect(initialOpenArea(cells, 'delta')).toBe('delta');
    expect(initialOpenArea(cells, 'alpha')).toBe('alpha');
    expect(initialOpenArea(cells, 'bravo')).toBe('bravo');
  });
  test('nothing requested, or an area without a cell: all closed', () => {
    expect(initialOpenArea(cells, 'oscar')).toBeNull();
    expect(initialOpenArea(cells, null)).toBeNull();
  });
});

describe('intelStats', () => {
  const slotA = '2026-10-17T11:00:00.000Z'; // 13:00 in Amsterdam
  const slotB = '2026-10-17T12:00:00.000Z'; // 14:00
  const at = (slotTime: string, area: string, status: HintCell['status'], solvedAfterMin?: number): HintCell =>
    ({
      _id: `${slotTime}-${area}`,
      articleId: 1,
      area,
      publishAt: slotTime,
      slotTime,
      status,
      articleChanged: false,
      solvedAt: solvedAfterMin === undefined ? undefined : new Date(new Date(slotTime).getTime() + solvedAfterMin * 60_000).toISOString(),
    }) as HintCell;

  test('hints: geen-hint cells are not counted; percent rounded; null without hints', () => {
    const stats = intelStats([], [at(slotA, 'alpha', 'solved'), at(slotA, 'bravo', 'open'), at(slotA, 'charlie', 'open'), at(slotA, 'delta', 'none')]);
    expect(stats.hints).toEqual({ solved: 1, total: 3, percent: 33 });
    expect(intelStats([], []).hints).toEqual({ solved: 0, total: 0, percent: null });
    expect(intelStats([], [at(slotA, 'alpha', 'none')]).hints.percent).toBeNull();
  });

  test('assignments: submitted count, judged count and the points jotihunt.nl gave (not the max points)', () => {
    const judged = (points: number | null) => ({ submitted: true, judged: true, points });
    const items = [
      { kind: 'assignment', maxPoints: 30, assignment: { status: 'submitted', site: judged(8) } },
      { kind: 'assignment', maxPoints: 50, assignment: { status: 'busy' } },
      { kind: 'assignment', maxPoints: undefined, assignment: { status: 'submitted', site: { submitted: true, judged: false, points: null } } },
      { kind: 'assignment', maxPoints: 40, assignment: { status: 'submitted', site: judged(30) } },
      { kind: 'news', unread: true },
    ] as IntelItem[];
    expect(intelStats(items, []).assignments).toEqual({ submitted: 3, total: 4, judged: 2, points: 38 });
  });

  test('unread per kind', () => {
    const items = [{ kind: 'news', unread: true }, { kind: 'news', unread: false }, { kind: 'assignment', unread: true }, { kind: 'hint', unread: false }] as IntelItem[];
    expect(intelStats(items, []).unread).toEqual({ news: 1, assignment: 1 });
  });

  test('slots: oldest first, solved/open per slot, none skipped, hour in Dutch time, last 8 only', () => {
    const stats = intelStats([], [at(slotB, 'alpha', 'open'), at(slotA, 'alpha', 'solved'), at(slotA, 'bravo', 'open'), at(slotB, 'bravo', 'none')]);
    expect(stats.slots).toEqual([
      { slotTime: slotA, hour: '13', solved: 1, open: 1 },
      { slotTime: slotB, hour: '14', solved: 0, open: 1 },
    ]);
    const many = Array.from({ length: 10 }, (_, index) => at(new Date(Date.UTC(2026, 9, 17, index)).toISOString(), 'alpha', 'open'));
    const slots = intelStats([], many).slots;
    expect(slots).toHaveLength(8);
    expect(slots[0].slotTime).toBe('2026-10-17T02:00:00.000Z');
  });

  test('average solve time over solved cells with solvedAt in the shown slots', () => {
    const stats = intelStats([], [at(slotA, 'alpha', 'solved', 10), at(slotA, 'bravo', 'solved', 30), at(slotA, 'charlie', 'solved'), at(slotB, 'alpha', 'open')]);
    expect(stats.avgSolveMs).toBe(20 * 60_000);
    expect(intelStats([], [at(slotA, 'alpha', 'solved')]).avgSolveMs).toBeNull();
  });
});

describe('stat labels', () => {
  test('formatSolveTime', () => {
    expect(formatSolveTime(18 * 60_000)).toBe('18 min');
    expect(formatSolveTime(89 * 60_000)).toBe('89 min');
    expect(formatSolveTime(65 * 60_000 + 25 * 60_000)).toBe('1 u 30');
    expect(formatSolveTime(125 * 60_000)).toBe('2 u 05');
  });
  test('unreadLabel and unreadTab', () => {
    expect(unreadLabel({ news: 2, assignment: 1 })).toBe('nieuws · 1 opdracht');
    expect(unreadLabel({ news: 0, assignment: 2 })).toBe('opdrachten');
    expect(unreadLabel({ news: 3, assignment: 0 })).toBe('nieuws');
    expect(unreadLabel({ news: 0, assignment: 0 })).toBe('alles gelezen');
    expect(unreadTab({ news: 0, assignment: 2 })).toBe('assignment');
    expect(unreadTab({ news: 1, assignment: 2 })).toBe('news');
    expect(unreadTab({ news: 0, assignment: 0 })).toBe('news');
  });
});

describe('chartColumns', () => {
  const hourMs = 60 * 60_000;
  const base = Date.UTC(2026, 9, 17, 10); // 12:00 in Amsterdam
  const past = (count: number) =>
    Array.from({ length: count }, (_, index) => ({ slotTime: new Date(base + index * hourMs).toISOString(), hour: '', solved: 1, open: 1 }));
  const kinds = (columns: ReturnType<typeof chartColumns>) => columns.map((column) => column.kind);

  test('one hint: the rest of the 8 columns are upcoming slots, the first one is next', () => {
    const columns = chartColumns(past(1), new Date(base + hourMs), base + 20 * hourMs);
    expect(kinds(columns)).toEqual(['past', 'next', 'later', 'later', 'later', 'later', 'later', 'later']);
    expect(columns[1]).toMatchObject({ kind: 'next', slotTime: new Date(base + hourMs).toISOString(), hour: '13' });
    expect(columns[2]).toMatchObject({ hour: '14' });
  });

  test('a full chart keeps room for the next hint by dropping the oldest', () => {
    const columns = chartColumns(past(8), new Date(base + 8 * hourMs), base + 20 * hourMs);
    expect(kinds(columns)).toEqual(['past', 'past', 'past', 'past', 'past', 'past', 'past', 'next']);
    expect(columns[0]).toMatchObject({ slot: { slotTime: new Date(base + hourMs).toISOString() } });
  });

  test('no upcoming slots after the last hint slot', () => {
    expect(kinds(chartColumns(past(3), new Date(base + 3 * hourMs), base + 4 * hourMs))).toEqual(['past', 'past', 'past', 'next', 'later']);
    expect(kinds(chartColumns(past(3), null, base))).toEqual(['past', 'past', 'past']);
  });

  test('before the first hint: only upcoming slots', () => {
    expect(kinds(chartColumns([], new Date(base), base + 2 * hourMs))).toEqual(['next', 'later', 'later']);
  });
});

describe('jotihunt.nl submission', () => {
  const assignment = (overrides: Partial<Assignment> = {}): Assignment => ({ _id: 'a1', articleId: 1, status: 'submitted', notes: [], ...overrides });
  const site = { submitted: true, imageUrl: 'https://cdn.jotihunt.net/x.jpg', answerText: null, rating: 4, judgement: 'Nog niet beoordeeld', judged: false, points: null, checkedAt: '2026-10-17T12:00:00Z' };

  test('null when not handed in or unknown', () => {
    expect(siteSubmission(undefined)).toBeNull();
    expect(siteSubmission(assignment())).toBeNull();
    expect(siteSubmission(assignment({ site: { ...site, submitted: false } }))).toBeNull();
  });

  test('keeps a full submission', () => {
    expect(siteSubmission(assignment({ site }))).toEqual(site);
  });

  test('drops malformed fields', () => {
    const odd = { submitted: true, imageUrl: 'javascript:alert(1)', rating: 9, judgement: '  ', points: '12', checkedAt: 5 } as unknown as Assignment['site'];
    expect(siteSubmission(assignment({ site: odd }))).toEqual({ submitted: true, imageUrl: null, answerText: null, rating: null, judgement: null, judged: false, points: null, checkedAt: null });
  });

  test('judged: points and the green status label; before that our own status', () => {
    const done = assignment({ site: { ...site, judgement: 'Beoordeeld (8 punten) Mooi', judged: true, points: 8 } });
    expect(earnedPoints(done)).toBe(8);
    expect(assignmentStatusLabel(done)).toEqual({ label: 'Beoordeeld · 8 pt', judged: true });
    expect(earnedPoints(assignment({ site }))).toBeNull();
    expect(assignmentStatusLabel(assignment({ site }))).toEqual({ label: 'Ingeleverd', judged: false });
    expect(assignmentStatusLabel(undefined)).toEqual({ label: 'Open', judged: false });
    expect(siteSubmission(assignment({ site: { ...site, imageUrl: null, answerText: ' Murkalotl ' } }))?.answerText).toBe('Murkalotl');
  });

  test('stars out of 5', () => {
    expect(ratingStars(4)).toBe('★★★★☆');
    expect(ratingStars(0)).toBe('☆☆☆☆☆');
  });

  test('status author: a person, jotihunt.nl (null) or nobody yet', () => {
    const clock = () => '14:02';
    expect(statusAuthor(assignment({ statusAt: 'x', statusBy: { _id: 'u1', name: 'Sanne' } as Assignment['statusBy'] }), clock)).toBe('Sanne · 14:02');
    expect(statusAuthor(assignment({ statusAt: 'x', statusBy: null }), clock)).toBe('jotihunt.nl · 14:02');
    expect(statusAuthor(assignment(), clock)).toBeUndefined();
    expect(statusAuthor(undefined, clock)).toBeUndefined();
  });
});
