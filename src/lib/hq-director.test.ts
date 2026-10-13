import { describe, expect, test } from 'bun:test';
import {
  advance,
  buildFoxes,
  cooldownEvent,
  endedCooldowns,
  enqueue,
  EVENT_HOLD_MS,
  eventFromNotification,
  eventHoldMs,
  FLY_MS,
  focusPoint,
  foxGroup,
  homeTarget,
  huntEvent,
  INITIAL_DIRECTOR,
  newReports,
  teamsBounds,
  tourStops,
  type HqEvent,
  type HqFox,
} from './hq-director';
import type { AppNotification } from './notifications';
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

const note = (type: AppNotification['type'], data: AppNotification['data'] = {}): AppNotification => ({ id: `n-${type}`, type, title: 'Titel', body: 'Tekst', urgent: true, data, createdAt: '' });
const ev = (key: string): HqEvent => ({ key, title: key, detail: '', tone: 'neutral', camera: null });

describe('eventFromNotification', () => {
  test('fox status flies to the area', () => {
    expect(eventFromNotification(note('fox-status', { area: 'Delta', status: 'green', previousStatus: 'orange' }))).toEqual({
      key: 'area:delta',
      title: 'Delta is Actief',
      detail: 'Was Onderweg',
      tone: 'ok',
      camera: { kind: 'area', area: 'delta', zoom: 11.6 },
    });
  });
  test('fox status without an area is ignored', () => expect(eventFromNotification(note('fox-status', { status: 'green' }))).toBeNull());
  test('tegenhunt flies home with the direction', () => {
    const event = eventFromNotification(note('counter-hunt', { direction: 90 }))!;
    expect(event.tone).toBe('danger');
    expect(event.camera).toEqual({ kind: 'home', direction: 90 });
  });
  test('broadcast, deadline and happy hour: warn card, no camera', () => {
    for (const type of ['broadcast', 'hunt-deadline', 'happy-hour'] as const) {
      expect(eventFromNotification(note(type))).toEqual({ key: `n-${type}`, title: 'Titel', detail: 'Tekst', tone: 'warn', camera: null });
    }
  });
  test('hint and article: neutral card, no camera', () => expect(eventFromNotification(note('hint'))?.tone).toBe('neutral'));
});

describe('new hunts', () => {
  const report = (id: string) => ({ _id: id, area: 'bravo', huntCode: '7KQ2XM', reportedByName: 'Jesse' }) as HuntReport;
  test('nothing on the first load', () => expect(newReports(null, [report('a')])).toEqual([]));
  test('reports not seen before', () => expect(newReports(new Set(['a']), [report('b'), report('a')]).map((r) => r._id)).toEqual(['b']));
  test('hunt event', () => {
    expect(huntEvent(report('b'))).toEqual({
      key: 'area:bravo',
      title: 'Hunt op Bravo!',
      detail: '7KQ2XM · door Jesse · cooldown gestart',
      tone: 'ok',
      camera: { kind: 'area', area: 'bravo', zoom: 12.4 },
    });
    expect(huntEvent({ ...report('c'), huntCode: null }).detail).toBe('Code wordt gelezen · door Jesse · cooldown gestart');
  });
});

describe('ended cooldowns', () => {
  test('nothing on the first check', () => expect(endedCooldowns(null, [fox('bravo', 'green')])).toEqual([]));
  test('cooldown went to 0 on a huntable fox', () => {
    const previous = new Map([['bravo', 1000], ['golf', 1000], ['charlie', 0]]);
    expect(endedCooldowns(previous, [fox('bravo', 'green'), fox('golf', 'red'), fox('charlie', 'green')]).map((f) => f.key)).toEqual(['bravo']);
  });
  test('cooldown event', () => {
    expect(cooldownEvent({ ...fox('foxtrot', 'green'), lastHunt: '2026-10-17T18:31:00Z' })).toEqual({
      key: 'area:foxtrot',
      title: 'Foxtrot is weer te hunten',
      detail: 'Cooldown voorbij · laatste hunt 20:31',
      tone: 'ok',
      camera: { kind: 'area', area: 'foxtrot', zoom: 11.6 },
    });
  });
});

describe('director queue', () => {
  test('first event interrupts the tour', () => {
    const state = enqueue(INITIAL_DIRECTOR, [ev('a'), ev('b')]);
    expect(state.current?.key).toBe('a');
    expect(state.queue.map((e) => e.key)).toEqual(['b']);
    expect(state.step).toBe(1);
  });
  test('a queued event with the same key is replaced in place', () => {
    const state = enqueue(enqueue(INITIAL_DIRECTOR, [ev('a'), ev('b'), ev('c')]), [{ ...ev('b'), title: 'nieuw' }]);
    expect(state.queue.map((e) => e.title)).toEqual(['nieuw', 'c']);
    expect(state.step).toBe(1);
  });
  test('an event for what is on screen is dropped', () => expect(enqueue(enqueue(INITIAL_DIRECTOR, [ev('a')]), [ev('a')]).queue).toEqual([]));
  test('advance plays the queue, then resumes the tour at the next stop', () => {
    let state = enqueue({ ...INITIAL_DIRECTOR, tourIndex: 2 }, [ev('a'), ev('b')]);
    state = advance(state);
    expect(state.current?.key).toBe('b');
    state = advance(state);
    expect(state.current).toBeNull();
    expect(state.tourIndex).toBe(3);
    expect(state.step).toBe(3);
  });
  test('advance on the tour goes to the next stop', () => expect(advance(INITIAL_DIRECTOR)).toEqual({ current: null, queue: [], tourIndex: 1, step: 1 }));
});

describe('eventHoldMs', () => {
  const event = (camera: HqEvent['camera']): HqEvent => ({ key: 'k', title: 't', detail: 'd', tone: 'neutral', camera });

  test('an event without a camera holds 30 s, no flight', () => {
    expect(eventHoldMs(event(null))).toBe(EVENT_HOLD_MS);
  });

  test('an event with a camera holds 30 s after the flight', () => {
    expect(eventHoldMs(event({ kind: 'area', area: 'alpha', zoom: 12.4 }))).toBe(FLY_MS + EVENT_HOLD_MS);
    expect(eventHoldMs(event({ kind: 'home', direction: null }))).toBe(FLY_MS + EVENT_HOLD_MS);
  });
});
