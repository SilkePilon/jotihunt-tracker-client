import { describe, expect, test } from 'bun:test';
import type { Life360LinkedStatus } from '@/types/Life360';
import { life360Fixture } from './life360-fixtures';
import {
  formatAgeShort,
  formatAgo,
  isLocationStale,
  LIFE360_STALE_MS,
  life360AdminRefreshInterval,
  life360HeaderSummary,
  life360LiveLine,
  life360MembersRefreshInterval,
  life360View,
  membersPillText,
} from './life360';

const NOW = Date.parse('2026-10-17T12:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const linked = life360Fixture('linked', NOW).status as Life360LinkedStatus;

describe('life360View', () => {
  test('loading and error before the first status', () => {
    expect(life360View(undefined, false, false)).toBe('loading');
    expect(life360View(undefined, true, false)).toBe('error');
  });

  test('unlinked shows the button, or the e-mail step once opened', () => {
    expect(life360View({ state: 'unlinked' }, false, false)).toBe('unlinked');
    expect(life360View({ state: 'unlinked' }, false, true)).toBe('email');
  });

  test('every other state is its own view, whatever the e-mail step', () => {
    for (const name of ['unavailable', 'code', 'circle', 'linked', 'loggedOut', 'paused'] as const) {
      expect(life360View(life360Fixture(name, NOW).status, false, true)).toBe(name);
    }
  });

  test('a status wins over a later fetch error (SWR keeps the last data)', () => {
    expect(life360View(linked, true, false)).toBe('linked');
  });
});

test('life360HeaderSummary: live count with an ok cookie, warnings in amber', () => {
  expect(life360HeaderSummary(undefined)).toBeUndefined();
  expect(life360HeaderSummary({ state: 'unavailable' })).toEqual({ text: 'Niet ingesteld' });
  expect(life360HeaderSummary({ state: 'unlinked' })).toEqual({ text: 'Niet gekoppeld' });
  expect(life360HeaderSummary(life360Fixture('code', NOW).status)).toEqual({ text: 'Koppelen…' });
  expect(life360HeaderSummary(life360Fixture('circle', NOW).status)).toEqual({ text: 'Koppelen…' });
  expect(life360HeaderSummary(linked)).toEqual({ text: '4/6 live', tone: 'ok' });
  expect(life360HeaderSummary(life360Fixture('loggedOut', NOW).status)).toEqual({ text: 'Opnieuw koppelen', tone: 'warn' });
  expect(life360HeaderSummary(life360Fixture('paused', NOW).status)).toEqual({ text: 'Gepauzeerd', tone: 'warn' });
});

test('life360AdminRefreshInterval: 2 s while linking, 30 s once linked (also logged out / paused), else off', () => {
  expect(life360AdminRefreshInterval(life360Fixture('code', NOW).status)).toBe(2000);
  expect(life360AdminRefreshInterval(life360Fixture('circle', NOW).status)).toBe(2000);
  expect(life360AdminRefreshInterval(linked)).toBe(30_000);
  expect(life360AdminRefreshInterval(life360Fixture('loggedOut', NOW).status)).toBe(30_000);
  expect(life360AdminRefreshInterval(life360Fixture('paused', NOW).status)).toBe(30_000);
  expect(life360AdminRefreshInterval({ state: 'unlinked' })).toBe(0);
  expect(life360AdminRefreshInterval({ state: 'unavailable' })).toBe(0);
  expect(life360AdminRefreshInterval(undefined)).toBe(0);
});

test('life360MembersRefreshInterval: 15 s while linked, 60 s otherwise', () => {
  expect(life360MembersRefreshInterval({ linked: true, stale: false, members: [] })).toBe(15_000);
  expect(life360MembersRefreshInterval({ linked: false, stale: false, members: [] })).toBe(60_000);
  expect(life360MembersRefreshInterval(undefined)).toBe(60_000);
});

test('formatAgo: seconds, minutes, hours; undefined when missing or invalid', () => {
  expect(formatAgo(ago(12_000), NOW)).toBe('12 s geleden');
  expect(formatAgo(new Date(NOW + 5000).toISOString(), NOW)).toBe('0 s geleden');
  expect(formatAgo(ago(3 * 60_000 + 10_000), NOW)).toBe('3 min geleden');
  expect(formatAgo(ago(2 * 3_600_000 + 60_000), NOW)).toBe('2 uur geleden');
  expect(formatAgo(null, NOW)).toBeUndefined();
  expect(formatAgo('garbage', NOW)).toBeUndefined();
});

test('formatAgeShort: "nu", minutes, hours, "–" when invalid', () => {
  expect(formatAgeShort(ago(30_000), NOW)).toBe('nu');
  expect(formatAgeShort(ago(2 * 60_000), NOW)).toBe('2 min');
  expect(formatAgeShort(ago(38 * 60_000), NOW)).toBe('38 min');
  expect(formatAgeShort(ago(3 * 3_600_000), NOW)).toBe('3 uur');
  expect(formatAgeShort('garbage', NOW)).toBe('–');
});

test('isLocationStale: no fix, older than 15 min, or a stale link', () => {
  expect(isLocationStale(null, false, NOW)).toBe(true);
  expect(isLocationStale({ at: ago(60_000) }, false, NOW)).toBe(false);
  expect(isLocationStale({ at: ago(LIFE360_STALE_MS) }, false, NOW)).toBe(false);
  expect(isLocationStale({ at: ago(LIFE360_STALE_MS + 1) }, false, NOW)).toBe(true);
  expect(isLocationStale({ at: ago(60_000) }, true, NOW)).toBe(true);
  expect(isLocationStale({ at: 'garbage' }, false, NOW)).toBe(true);
});

test('life360LiveLine: live count and the age of the last poll', () => {
  expect(life360LiveLine(linked, NOW)).toBe('4 van 6 live · 12 s geleden');
  expect(life360LiveLine({ ...linked, lastPollAt: null }, NOW)).toBe('4 van 6 live');
});

test('membersPillText: circle and member count', () => {
  expect(membersPillText('Jotihunt 2026', 6)).toBe('Jotihunt 2026 · 6 leden');
  expect(membersPillText('Jotihunt 2026', 1)).toBe('Jotihunt 2026 · 1 lid');
});

test('the linked fixture counts its live members like the server (≤ 15 min)', () => {
  const { status, members } = life360Fixture('linked', NOW);
  const live = members.members.filter((member) => !isLocationStale(member.location, false, NOW)).length;
  expect(status.state === 'linked' && status.liveCount).toBe(live);
  expect(life360Fixture('paused', NOW).members.stale).toBe(true);
  expect(life360Fixture('unlinked', NOW).members).toEqual({ linked: false, stale: false, members: [] });
});
