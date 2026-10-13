import { describe, expect, test } from 'bun:test';
import { buildFoxes, focusPoint, foxGroup, homeTarget, teamsBounds, tourStops, type HqFox } from './hq-director';
import type { Area } from '@/types/Area';
import type { HuntReport } from '@/types/HuntReport';
import type { Prediction } from '@/types/Prediction';
import type { Team } from '@/types/Team';

const NOW = Date.parse('2026-10-17T20:00:00Z');
const area = (name: string, status: string) => ({ _id: name, name, status, updatedAt: '' }) as Area;
const team = (areaName: string, lng: number, lat: number) => ({ area: areaName, location: { type: 'Point', coordinates: [lng, lat] } }) as Team;
const prediction = (areaName: string, extra: Partial<Prediction>) => ({ area: areaName, pin: null, lastObservation: null, ...extra }) as Prediction;
const fox = (key: string, group: HqFox['group'], center: HqFox['center'] = [5, 52]): HqFox => ({ key, name: key[0].toUpperCase() + key.slice(1), group, cooldownMs: 0, lastHunt: undefined, center });

describe('foxGroup', () => {
  test('cooldown wins over the status', () => expect(foxGroup('green', 1000)).toBe('cooldown'));
  test('green and orange keep their group', () => {
    expect(foxGroup('green', 0)).toBe('green');
    expect(foxGroup('orange', 0)).toBe('orange');
  });
  test('red and unknown count as red', () => {
    expect(foxGroup('red', 0)).toBe('red');
    expect(foxGroup('', 0)).toBe('red');
  });
});

describe('focusPoint', () => {
  const teams = [team('alpha', 5.0, 52.0), team('alpha', 5.2, 52.2), team('bravo', 6, 53)];
  test('AI pin first', () => {
    const p = [prediction('Alpha', { pin: { lng: 5.5, lat: 52.5 }, lastObservation: { lng: 1, lat: 1, time: '', kind: 'hint' } })];
    expect(focusPoint('alpha', p, teams)).toEqual([5.5, 52.5]);
  });
  test('then the last observation', () => {
    const p = [prediction('alpha', { lastObservation: { lng: 5.3, lat: 52.3, time: '', kind: 'spot' } })];
    expect(focusPoint('alpha', p, teams)).toEqual([5.3, 52.3]);
  });
  test('then the centre of the area groups', () => {
    const [lng, lat] = focusPoint('alpha', [], teams)!;
    expect(lng).toBeCloseTo(5.1);
    expect(lat).toBeCloseTo(52.1);
  });
  test('null without any of those', () => expect(focusPoint('golf', [], teams)).toBeNull());
});

describe('buildFoxes', () => {
  test('groups, cooldown and capitalised name per area', () => {
    const report = { _id: 'r1', area: 'bravo', huntTime: new Date(NOW - 10 * 60_000).toISOString(), huntTimeKnown: true } as HuntReport;
    const foxes = buildFoxes({ areas: [area('alpha', 'green'), area('bravo', 'green')], reports: [report], teams: [team('alpha', 5, 52)], now: NOW });
    expect(foxes.map((f) => [f.key, f.name, f.group])).toEqual([
      ['alpha', 'Alpha', 'green'],
      ['bravo', 'Bravo', 'cooldown'],
    ]);
    expect(foxes[1].cooldownMs).toBe(50 * 60_000);
    expect(foxes[0].center).toEqual([5, 52]);
    expect(foxes[1].center).toBeNull();
  });
  test('no areas yet: empty', () => expect(buildFoxes({ now: NOW })).toEqual([]));
});

describe('teamsBounds', () => {
  test('south-west and north-east corner', () => expect(teamsBounds([team('a', 5, 52), team('b', 6, 51), team('c', 5.5, 53)])).toEqual([[5, 51], [6, 53]]));
  test('null without teams', () => expect(teamsBounds([])).toBeNull());
});

describe('tourStops', () => {
  test('overview first, then active and on-the-way foxes with a location', () => {
    const stops = tourStops([fox('alpha', 'red'), fox('bravo', 'cooldown'), fox('charlie', 'green'), fox('delta', 'orange'), fox('echo', 'green', null)]);
    expect(stops.map((s) => (s.kind === 'area' ? s.area : s.kind))).toEqual(['overview', 'charlie', 'delta']);
  });
  test('only the overview when no fox is tourable', () => expect(tourStops([fox('alpha', 'red')])).toEqual([{ kind: 'overview' }]));
});

describe('homeTarget', () => {
  test('home itself without a direction', () => expect(homeTarget([5.7, 52.1], null)).toEqual([5.7, 52.1]));
  test('250 m into the wind sector', () => {
    const [lng, lat] = homeTarget([5.7, 52.1], 0);
    expect(lng).toBeCloseTo(5.7, 5);
    expect(lat).toBeGreaterThan(52.1);
    expect(lat).toBeLessThan(52.11);
  });
});
