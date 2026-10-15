import { describe, expect, test } from 'bun:test';
import type { JotiboardLinkedStatus } from '@/types/Jotiboard';
import { countsText, hasImports, jotiboardHeaderSummary, jotiboardRefreshInterval, jotiboardSyncLine, jotiboardView, purgeText } from './jotiboard';

const NOW = Date.parse('2026-10-17T12:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const counts = { pins: 5, hints: 2 };
const linked = (overrides: Partial<JotiboardLinkedStatus> = {}): JotiboardLinkedStatus => ({
  state: 'linked',
  username: 'user',
  linkedAt: ago(3600_000),
  syncEnabled: true,
  lastSyncAt: ago(12_000),
  lastError: null,
  counts,
  ...overrides,
});

describe('views', () => {
  test('state → view', () => {
    expect(jotiboardView(undefined, false)).toBe('loading');
    expect(jotiboardView(undefined, true)).toBe('error');
    expect(jotiboardView({ state: 'unavailable' }, false)).toBe('unavailable');
    expect(jotiboardView({ state: 'unlinked', counts }, false)).toBe('unlinked');
    expect(jotiboardView(linked(), false)).toBe('syncing');
    expect(jotiboardView(linked({ lastError: 'x' }), false)).toBe('failing');
    expect(jotiboardView(linked({ syncEnabled: false, lastError: 'x' }), false)).toBe('paused');
    expect(jotiboardView({ state: 'loggedOut', username: 'user', counts }, false)).toBe('loggedOut');
  });

  test('header summaries (plain text)', () => {
    expect(jotiboardHeaderSummary({ state: 'unavailable' })).toBe('Niet ingesteld');
    expect(jotiboardHeaderSummary({ state: 'unlinked', counts })).toBe('Niet gekoppeld');
    expect(jotiboardHeaderSummary(linked())).toBe('Synchroniseert');
    expect(jotiboardHeaderSummary(linked({ lastError: 'x' }))).toBe('Fout');
    expect(jotiboardHeaderSummary(linked({ syncEnabled: false }))).toBe('Gepauzeerd');
    expect(jotiboardHeaderSummary({ state: 'loggedOut', username: 'user', counts })).toBe('Opnieuw inloggen');
  });
});

describe('texts', () => {
  test('counts', () => {
    expect(countsText({ pins: 5, hints: 2 })).toBe('5 pins · 2 hints');
    expect(countsText({ pins: 1, hints: 1 })).toBe('1 pin · 1 hint');
    expect(purgeText({ pins: 5, hints: 2 })).toBe('5 pins en 2 hints');
    expect(purgeText({ pins: 0, hints: 1 })).toBe('0 pins en 1 hint');
    expect(hasImports({ pins: 0, hints: 0 })).toBe(false);
    expect(hasImports({ pins: 0, hints: 1 })).toBe(true);
  });

  test('sync line per state', () => {
    expect(jotiboardSyncLine(linked(), NOW)).toBe('12 s geleden · 5 pins · 2 hints');
    expect(jotiboardSyncLine(linked({ lastSyncAt: null }), NOW)).toBe('Eerste sync… · 5 pins · 2 hints');
    expect(jotiboardSyncLine(linked({ lastError: 'x', lastSyncAt: ago(120_000) }), NOW)).toBe('Laatst gelukt 2 min geleden · 5 pins · 2 hints');
    expect(jotiboardSyncLine(linked({ syncEnabled: false, lastSyncAt: null }), NOW)).toBe('5 pins · 2 hints');
    expect(jotiboardSyncLine(linked({ syncEnabled: false, lastSyncAt: '2026-10-17T11:02:00Z' }), NOW)).toMatch(/^Laatst \d{2}:\d{2} · 5 pins · 2 hints$/);
  });
});

test('refresh interval: fast until the first sync', () => {
  expect(jotiboardRefreshInterval(linked({ lastSyncAt: null }))).toBe(3000);
  expect(jotiboardRefreshInterval(linked())).toBe(20_000);
  expect(jotiboardRefreshInterval(undefined)).toBe(20_000);
});
