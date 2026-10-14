import { describe, expect, test } from 'bun:test';
import type { Area } from '@/types/Area';
import type { Hunt } from '@/types/Hunt';
import type { HuntReport } from '@/types/HuntReport';
import { FOX_GROUP_ORDER, foxGroup, groupCounts, huntCooldownMs, HUNT_COOLDOWN_MS, lastHuntTimeFor, sidebarFoxes, statusPillClass } from './fox-status';

function hunt(area: string, status: string, huntTime: string): Hunt {
  return { _id: area + huntTime, area, huntCode: 'x', status, points: 1, huntTime: huntTime as unknown as Date, updatedAt: new Date() };
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

describe('lastHuntTimeFor with reports', () => {
  test('ignores reports whose time is not known yet (still being read)', () => {
    const reports = [{ area: 'alpha', huntTime: '2026-10-17T13:00:00Z', huntTimeKnown: false }] as HuntReport[];
    expect(lastHuntTimeFor(undefined, 'Alpha', reports)).toBeUndefined();
  });
  test('a registered hunt starts the cooldown before the scraper sees it', () => {
    const reports = [{ area: 'alpha', huntTime: '2026-10-17T13:00:00Z', huntTimeKnown: true }] as HuntReport[];
    const hunts = [hunt('Alpha', 'Goedgekeurd', '2026-10-17T11:00:00Z')];
    expect(new Date(lastHuntTimeFor(hunts, 'Alpha', reports)!).toISOString()).toBe('2026-10-17T13:00:00.000Z');
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

  test('empty input', () => expect(sidebarFoxes({ areas: [], now })).toEqual([]));

  test('group order constant', () => expect(FOX_GROUP_ORDER).toEqual(['green', 'orange', 'cooldown', 'red']));
});

describe('groupCounts', () => {
  test('counts every group, zero included', () => {
    const now = Date.now();
    const foxes = sidebarFoxes({ areas: [area('Alpha', 'green'), area('Bravo', 'red'), area('Charlie', 'green')], now });
    expect(groupCounts(foxes)).toEqual({ green: 2, orange: 0, cooldown: 0, red: 1 });
  });
});
