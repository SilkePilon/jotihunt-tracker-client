import { describe, expect, test } from 'bun:test';
import type { Area } from '@/types/Area';
import type { SyncedHunt } from '@/types/HuntSync';
import { formatOvDuration, FOX_GROUP_ORDER, foxGroup, groupCounts, huntCooldownMs, HUNT_COOLDOWN_MS, lastHuntTimeFor, legendGroups, sidebarFoxes, statusPillClass } from './fox-status';

function hunt(area: string, statusText: string, huntTime: string | null): SyncedHunt {
  return { _id: area + huntTime, siteKey: area + huntTime, area, huntTime, status: 'approved', statusText, points: 1, location: null, firstSeenAt: '2026-10-17T10:00:00Z', statusChangedAt: null };
}

function area(name: string, status: string): Area {
  return { _id: name, name, status, updatedAt: '2026-10-17T10:00:00Z' };
}

describe('lastHuntTimeFor', () => {
  test('first matching hunt, case-insensitive, skipping tegenhunts', () => {
    const hunts = [hunt('alpha', 'Tegenhunt', '2026-10-17T12:00:00Z'), hunt('Alpha', 'Goedgekeurd', '2026-10-17T11:00:00Z')];
    expect(lastHuntTimeFor(hunts, 'Alpha')).toBe('2026-10-17T11:00:00Z');
    expect(lastHuntTimeFor(hunts, 'Bravo')).toBeUndefined();
    expect(lastHuntTimeFor(undefined, 'Alpha')).toBeUndefined();
  });
});

describe('lastHuntTimeFor, latest wins', () => {
  test('the newest hunt time, whatever the order; hunts without a (valid) time are skipped', () => {
    const hunts = [hunt('alpha', 'Goedgekeurd', '2026-10-17T11:00:00Z'), hunt('alpha', 'Wacht op bevestiging', '2026-10-17T13:00:00Z'), hunt('alpha', 'x', null), hunt('alpha', 'x', 'nonsense')];
    expect(lastHuntTimeFor(hunts, 'Alpha')).toBe('2026-10-17T13:00:00Z');
  });
});

describe('huntCooldownMs', () => {
  const huntTime = '2026-10-17T11:00:00Z';
  const t = new Date(huntTime).getTime();
  test('counts down one hour after a hunt', () => {
    expect(huntCooldownMs(huntTime, t)).toBe(HUNT_COOLDOWN_MS);
    expect(huntCooldownMs(huntTime, t + 60_000)).toBe(HUNT_COOLDOWN_MS - 60_000);
    expect(huntCooldownMs(huntTime, t + HUNT_COOLDOWN_MS + 1)).toBe(0);
    expect(huntCooldownMs(undefined, t)).toBe(0);
  });
});

describe('statusPillClass', () => {
  test('maps statuses', () => {
    expect(statusPillClass('green')).toContain('green');
    expect(statusPillClass('orange')).toContain('orange');
    expect(statusPillClass('red')).toContain('red');
    expect(statusPillClass('unknown')).toContain('gray');
  });
});

describe('foxGroup', () => {
  test('cooldown wins over the status', () => expect(foxGroup('green', 1000)).toBe('cooldown'));
  test('green / orange stay, anything else is red', () => {
    expect(foxGroup('green', 0)).toBe('green');
    expect(foxGroup('orange', 0)).toBe('orange');
    expect(foxGroup('red', 0)).toBe('red');
    expect(foxGroup('', 0)).toBe('red');
  });
});

describe('sidebarFoxes', () => {
  const now = new Date('2026-10-17T14:00:00Z').getTime();
  const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString();

  test('orders green, orange, cooldown (soonest free first), red; then by area name', () => {
    const areas = [area('Oscar', 'red'), area('Bravo', 'green'), area('Alpha', 'green'), area('Delta', 'orange'), area('Echo', 'green'), area('Golf', 'purple'), area('Hotel', 'red')];
    const hunts = [hunt('echo', 'Goedgekeurd', minutesAgo(10)), hunt('bravo', 'Goedgekeurd', minutesAgo(50))];
    const foxes = sidebarFoxes({ areas, hunts, now });
    expect(foxes.map((fox) => fox.key)).toEqual(['alpha', 'delta', 'bravo', 'echo', 'golf', 'hotel', 'oscar']);
    expect(foxes.map((fox) => fox.group)).toEqual(['green', 'orange', 'cooldown', 'cooldown', 'red', 'red', 'red']);
    expect(foxes[2].cooldownMs).toBe(10 * 60_000);
    expect(foxes[2].name).toBe('Bravo');
    expect(foxes[2].area.name).toBe('Bravo');
    expect(foxes[0].lastHunt).toBeUndefined();
  });

  test('cooldown foxes with equal remaining time sort by area name', () => {
    const areas = [area('Charlie', 'green'), area('Alpha', 'green')];
    const hunts = [hunt('charlie', 'Goedgekeurd', minutesAgo(20)), hunt('alpha', 'Goedgekeurd', minutesAgo(20))];
    const foxes = sidebarFoxes({ areas, hunts, now });
    expect(foxes.map((fox) => fox.group)).toEqual(['cooldown', 'cooldown']);
    expect(foxes.map((fox) => fox.key)).toEqual(['alpha', 'charlie']);
  });

  test('empty input', () => expect(sidebarFoxes({ areas: [], now })).toEqual([]));

  test('group order constant', () => expect(FOX_GROUP_ORDER).toEqual(['green', 'orange', 'ov', 'cooldown', 'red']));
});

describe('groupCounts', () => {
  test('counts every group, zero included', () => {
    const now = new Date('2026-10-17T14:00:00Z').getTime();
    const foxes = sidebarFoxes({ areas: [area('Alpha', 'green'), area('Bravo', 'red'), area('Charlie', 'green')], now });
    expect(groupCounts(foxes)).toEqual({ green: 2, orange: 0, ov: 0, cooldown: 0, red: 1 });
  });
});

describe('ov (blue)', () => {
  test('blue is the ov group, also during a cooldown', () => {
    expect(foxGroup('blue', 0)).toBe('ov');
    expect(foxGroup('blue', 5000)).toBe('ov');
  });
  test('order and counts', () => {
    expect(FOX_GROUP_ORDER).toEqual(['green', 'orange', 'ov', 'cooldown', 'red']);
    const foxes = sidebarFoxes({ areas: [area('Oscar', 'blue'), area('Alpha', 'green'), area('Hotel', 'red')], now: Date.parse('2026-10-17T12:00:00Z') });
    expect(foxes.map((fox) => fox.key)).toEqual(['alpha', 'oscar', 'hotel']);
    expect(groupCounts(foxes)).toEqual({ green: 1, orange: 0, ov: 1, cooldown: 0, red: 1 });
  });
  test('legend hides ov when there is none', () => {
    expect(legendGroups({ green: 1, orange: 0, ov: 0, cooldown: 0, red: 1 })).toEqual(['green', 'orange', 'cooldown', 'red']);
    expect(legendGroups({ green: 1, orange: 0, ov: 1, cooldown: 0, red: 1 })).toEqual(['green', 'orange', 'ov', 'cooldown', 'red']);
  });
  test('formatOvDuration', () => {
    expect(formatOvDuration(-5)).toBe('< 1 min');
    expect(formatOvDuration(59_000)).toBe('< 1 min');
    expect(formatOvDuration(12 * 60_000 + 30_000)).toBe('12 min');
    expect(formatOvDuration(65 * 60_000)).toBe('1 u 5 min');
    expect(formatOvDuration(120 * 60_000)).toBe('2 u');
  });
});
