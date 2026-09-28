import { describe, expect, test } from 'bun:test';
import type { Area } from '@/types/Area';
import type { Hunt } from '@/types/Hunt';
import type { HuntReport } from '@/types/HuntReport';
import { cooldownSummary, huntCooldownMs, HUNT_COOLDOWN_MS, lastHuntTimeFor, statusPillClass, statusSummary } from './fox-status';

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
  test('a registered hunt starts the cooldown before the scraper sees it', () => {
    const reports = [{ area: 'alpha', kind: 'hunt', huntTime: '2026-10-17T13:00:00Z' }] as HuntReport[];
    const hunts = [hunt('Alpha', 'Goedgekeurd', '2026-10-17T11:00:00Z')];
    expect(new Date(lastHuntTimeFor(hunts, 'Alpha', reports)!).toISOString()).toBe('2026-10-17T13:00:00.000Z');
  });
  test('registered tegenhunts do not count', () => {
    const reports = [{ area: 'alpha', kind: 'tegenhunt', huntTime: '2026-10-17T13:00:00Z' }] as HuntReport[];
    expect(lastHuntTimeFor(undefined, 'Alpha', reports)).toBeUndefined();
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

describe('statusPillClass / statusSummary', () => {
  test('maps statuses', () => {
    expect(statusPillClass('green')).toContain('green');
    expect(statusPillClass('orange')).toContain('orange');
    expect(statusPillClass('red')).toContain('red');
    expect(statusPillClass('unknown')).toContain('gray');
  });

  test('summarises counts in Dutch', () => {
    expect(statusSummary([area('Alpha', 'green'), area('Bravo', 'red'), area('Charlie', 'green'), area('Delta', 'orange')])).toBe(
      '2 groen · 1 oranje · 1 rood',
    );
  });
});

describe('cooldownSummary', () => {
  const now = new Date('2026-10-17T12:00:00Z').getTime();

  test('lists only areas still cooling down, by first-letter and countdown', () => {
    const areas = [area('Alpha', 'green'), area('Delta', 'orange'), area('Bravo', 'red')];
    // Alpha's cooldown ends at 12:23:12 (23:12 left), Delta's at 12:04:10 (4:10 left)
    const hunts = [hunt('Alpha', 'Goedgekeurd', '2026-10-17T11:23:12Z'), hunt('Delta', 'Goedgekeurd', '2026-10-17T11:04:10Z')];
    expect(cooldownSummary(areas, hunts, now)).toBe('A 23:12 · D 4:10');
  });

  test('returns undefined when nothing is cooling down', () => {
    expect(cooldownSummary([area('Alpha', 'green')], undefined, now)).toBeUndefined();
  });
});
