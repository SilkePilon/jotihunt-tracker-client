import { describe, expect, test } from 'bun:test';
import type { HuntSyncEvent, HuntSyncStatus } from '@/types/HuntSync';
import { flattenEventPages, huntEventParts, huntEventTime, huntEventsPath, huntEventText, huntSyncLine, huntSyncSummary, huntSyncView, resultBarShares } from './hunt-sync';

const NOW = Date.parse('2026-10-17T21:45:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const status = (overrides: Partial<HuntSyncStatus> = {}): HuntSyncStatus => ({
  configured: true,
  running: false,
  lastSuccessAt: ago(12_000),
  lastAttemptAt: ago(12_000),
  lastError: null,
  counts: { approved: 7, pending: 1, rejected: 1, total: 9 },
  points: 70,
  ...overrides,
});

const event = (overrides: Partial<HuntSyncEvent> = {}): HuntSyncEvent => ({
  _id: 'e1',
  huntId: 'h1',
  area: 'alpha',
  type: 'new',
  points: null,
  at: ago(60_000),
  huntTime: ago(120_000),
  location: null,
  ...overrides,
});

describe('huntSyncView', () => {
  test('states', () => {
    expect(huntSyncView(status())).toBe('synced');
    expect(huntSyncView(status({ configured: false, running: true }))).toBe('unlinked');
    expect(huntSyncView(status({ running: true, lastError: 'x' }))).toBe('syncing');
    expect(huntSyncView(status({ lastError: 'x', lastSuccessAt: ago(240_000), lastAttemptAt: ago(10_000) }))).toBe('failing');
    expect(huntSyncView(status({ lastError: 'x', lastSuccessAt: null }))).toBe('failing');
  });

  test('a stale error older than the last success does not count', () => {
    expect(huntSyncView(status({ lastError: 'x', lastSuccessAt: ago(5_000), lastAttemptAt: ago(5_000) }))).toBe('synced');
  });
});

describe('huntSyncLine', () => {
  test('synced', () => {
    expect(huntSyncLine(status(), NOW)).toBe('jotihunt.nl · 12 s geleden · 9 hunts · 70 pnt');
    expect(huntSyncLine(status({ lastSuccessAt: null, counts: { approved: 0, pending: 1, rejected: 0, total: 1 }, points: 0 }), NOW)).toBe('jotihunt.nl · 1 hunt · 0 pnt');
  });

  test('syncing, failing, unlinked', () => {
    expect(huntSyncLine(status({ running: true }), NOW)).toBe('jotihunt.nl · hunts ophalen');
    expect(huntSyncLine(status({ lastError: 'x', lastSuccessAt: ago(4 * 60_000), lastAttemptAt: ago(5_000) }), NOW)).toBe('laatst gelukt 4 min geleden · probeert opnieuw');
    expect(huntSyncLine(status({ lastError: 'x', lastSuccessAt: null }), NOW)).toBe('nog niet gelukt · probeert opnieuw');
    expect(huntSyncLine(status({ configured: false }), NOW)).toBe('Een beheerder koppelt het jotihunt.nl-account in Beheer.');
  });
});

test('huntSyncSummary', () => {
  expect(huntSyncSummary(undefined)).toBeUndefined();
  expect(huntSyncSummary(status())).toBe('70 pnt · 1 wacht');
  expect(huntSyncSummary(status({ counts: { approved: 2, pending: 0, rejected: 0, total: 2 }, points: 20 }))).toBe('20 pnt');
  expect(huntSyncSummary(status({ configured: false }))).toBe('Niet gekoppeld');
});

describe('event text', () => {
  test('per type', () => {
    expect(huntEventText(event())).toBe('Alpha binnengekomen');
    expect(huntEventText(event({ area: 'delta', type: 'approved', points: 10 }))).toBe('Delta goedgekeurd +10');
    expect(huntEventText(event({ area: 'echo', type: 'rejected' }))).toBe('Echo afgekeurd');
    expect(huntEventText(event({ area: 'delta', type: 'points', points: 15 }))).toBe('Delta punten aangepast · 15');
  });

  test('parts keep the points tag apart', () => {
    expect(huntEventParts(event({ area: 'delta', type: 'approved', points: 10 }))).toEqual({ area: 'Delta', text: 'goedgekeurd', points: '+10' });
    expect(huntEventParts(event({ type: 'approved', points: null })).points).toBeNull();
  });
});

test('huntEventTime: hunt time for a new hunt, else when the sync noticed it', () => {
  expect(huntEventTime(event())).toBe(ago(120_000));
  expect(huntEventTime(event({ huntTime: null }))).toBe(ago(60_000));
  expect(huntEventTime(event({ huntTime: 'nonsense' }))).toBe(ago(60_000));
  expect(huntEventTime(event({ type: 'approved', points: 10 }))).toBe(ago(60_000));
  expect(huntEventTime(event({ type: 'rejected' }))).toBe(ago(60_000));
  expect(huntEventTime(event({ type: 'points', points: 5 }))).toBe(ago(60_000));
});

test('resultBarShares', () => {
  expect(resultBarShares({ approved: 0, pending: 0, rejected: 0, total: 0 })).toEqual({ approved: 0, pending: 0, rejected: 0 });
  expect(resultBarShares({ approved: 2, pending: 1, rejected: 1, total: 4 })).toEqual({ approved: 0.5, pending: 0.25, rejected: 0.25 });
});

describe('paging', () => {
  test('flatten drops duplicates and malformed pages', () => {
    const a = event({ _id: 'a' });
    const b = event({ _id: 'b' });
    expect(flattenEventPages([[a, b], [b], {} as unknown as HuntSyncEvent[]]).map((e) => e._id)).toEqual(['a', 'b']);
    expect(flattenEventPages(undefined)).toEqual([]);
  });

  test('keys', () => {
    expect(huntEventsPath(0, null)).toBe('/hunts/events?limit=50');
    expect(huntEventsPath(1, [event()])).toBeNull();
    const full = Array.from({ length: 50 }, (_, i) => event({ _id: String(i), at: '2026-10-17T20:00:00.000Z' }));
    expect(huntEventsPath(1, full)).toBe('/hunts/events?limit=50&before=2026-10-17T20%3A00%3A00.000Z');
  });
});
