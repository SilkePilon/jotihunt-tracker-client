import { describe, expect, test } from 'bun:test';
import {
  advance,
  buildFoxes,
  cooldownEvent,
  endedCooldowns,
  enqueue,
  EVENT_HOLD_MS,
  eventTarget,
  eventFromNotification,
  eventHoldMs,
  FLY_MS,
  focusPoint,
  foxGroup,
  homeTarget,
  huntEvent,
  INITIAL_DIRECTOR,
  newSyncEvents,
  teamsBounds,
  tourStops,
  type HqEvent,
  type HqFox,
} from './hq-director';
import type { AppNotification } from './notifications';
import type { Area } from '@/types/Area';
import type { HuntSyncEvent, SyncedHunt } from '@/types/HuntSync';
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
    const hunt = { _id: 'h1', area: 'bravo', huntTime: new Date(NOW - 10 * 60_000).toISOString(), statusText: 'Wacht op bevestiging' } as SyncedHunt;
    const foxes = buildFoxes({ areas: [area('alpha', 'green'), area('bravo', 'green')], hunts: [hunt], teams: [team('alpha', 5, 52)], now: NOW });
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
const ev = (key: string, kind: HqEvent['kind'] = 'message'): HqEvent => ({ key, kind, title: key, detail: '', tone: 'neutral', camera: null });

describe('eventFromNotification', () => {
  test('fox status flies to the area', () => {
    expect(eventFromNotification(note('fox-status', { area: 'Delta', status: 'green', previousStatus: 'orange' }))).toEqual({
      key: 'area:delta',
      kind: 'fox-status',
      title: 'Delta is Actief',
      detail: 'Was Onderweg',
      tone: 'ok',
      camera: { kind: 'area', area: 'delta', zoom: 11.6 },
    });
  });
  test('fox status without an area is ignored', () => expect(eventFromNotification(note('fox-status', { status: 'green' }))).toBeNull());
  test('tegenhunt flies home with the direction', () => {
    const event = eventFromNotification(note('counter-hunt', { direction: 90 }))!;
    expect(event.kind).toBe('counter-hunt');
    expect(event.tone).toBe('danger');
    expect(event.camera).toEqual({ kind: 'home', direction: 90 });
  });
  test('tegenhunt: the direction in the title, the task in the detail (no server body that says "richting")', () => {
    const event = eventFromNotification(note('counter-hunt', { direction: 45 }))!;
    expect(event.title).toBe('Tegenhunt uit het noordoosten');
    expect(event.detail).toBe('Zoek de sticker binnen 500 m van het clubhuis');
  });
  test('tegenhunt without a known direction: the notification title and body', () => {
    const event = eventFromNotification(note('counter-hunt'))!;
    expect(event.title).toBe('Titel');
    expect(event.detail).toBe('Tekst');
    expect(eventFromNotification({ ...note('counter-hunt'), title: '' })!.title).toBe('Tegenhunt!');
  });
  test('every tegenhunt gets its own key, so a second one is not dropped', () => {
    const first = eventFromNotification({ ...note('counter-hunt', { direction: 0 }), id: 'a' })!;
    const second = eventFromNotification({ ...note('counter-hunt', { direction: 90 }), id: 'b' })!;
    expect(first.key).not.toBe(second.key);
    expect(enqueue(enqueue(INITIAL_DIRECTOR, [first]), [second]).queue).toEqual([second]);
  });
  test('broadcast, deadline and happy hour: warn card, no camera', () => {
    for (const type of ['broadcast', 'hunt-deadline', 'happy-hour'] as const) {
      expect(eventFromNotification(note(type))).toEqual({ key: `n-${type}`, kind: 'message', title: 'Titel', detail: 'Tekst', tone: 'warn', camera: null });
    }
  });
  test('hint and article: neutral card, no camera', () => expect(eventFromNotification(note('hint'))?.tone).toBe('neutral'));
});

describe('hunt sync events', () => {
  const event = (id: string, overrides: Partial<HuntSyncEvent> = {}): HuntSyncEvent => ({
    _id: id, huntId: 'h', area: 'bravo', type: 'new', points: null, at: '2026-10-17T19:43:00Z', huntTime: '2026-10-17T19:42:00Z', location: null, ...overrides,
  });
  test('nothing on the first load', () => expect(newSyncEvents(null, [event('a')])).toEqual([]));
  test('lines not seen before', () => expect(newSyncEvents(new Set(['a']), [event('b'), event('a')]).map((e) => e._id)).toEqual(['b']));
  test('a new hunt flies to the fox', () => {
    expect(huntEvent(event('b'))).toEqual({
      key: 'area:bravo',
      kind: 'hunt',
      title: 'Hunt op Bravo!',
      detail: '21:42 · via jotihunt.nl · cooldown gestart',
      tone: 'ok',
      camera: { kind: 'area', area: 'bravo', zoom: 12.4 },
    });
    expect(huntEvent(event('c', { huntTime: null })).detail).toBe('via jotihunt.nl · cooldown gestart');
  });
  test('verdicts and points only show the card', () => {
    expect(huntEvent(event('d', { type: 'approved', points: 10 }))).toMatchObject({ title: 'Hunt op Bravo goedgekeurd', detail: '+10 punten', tone: 'ok', camera: null });
    expect(huntEvent(event('e', { type: 'rejected' }))).toMatchObject({ title: 'Hunt op Bravo afgekeurd', tone: 'warn', camera: null });
    expect(huntEvent(event('f', { type: 'points', points: 15 })).detail).toBe('Nu 15 punten');
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
      kind: 'cooldown',
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
  test('a status change does not replace a queued hunt on the same area', () => {
    const state = enqueue(enqueue(INITIAL_DIRECTOR, [ev('a'), ev('area:bravo', 'hunt')]), [ev('area:bravo', 'fox-status')]);
    expect(state.queue.map((e) => e.kind)).toEqual(['hunt']);
  });
  test('a hunt still replaces a queued status change on the same area', () => {
    const state = enqueue(enqueue(INITIAL_DIRECTOR, [ev('a'), ev('area:bravo', 'fox-status')]), [ev('area:bravo', 'hunt')]);
    expect(state.queue.map((e) => e.kind)).toEqual(['hunt']);
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
  test('no flight: 30 s', () => expect(eventHoldMs(false)).toBe(EVENT_HOLD_MS));
  test('with a flight: 30 s after the flight', () => expect(eventHoldMs(true)).toBe(FLY_MS + EVENT_HOLD_MS));
});

describe('eventTarget', () => {
  const event = (camera: HqEvent['camera']): HqEvent => ({ key: 'k', kind: 'message', title: 't', detail: 'd', tone: 'neutral', camera });
  const home = { location: { type: 'Point', coordinates: [5.5, 52.1] } } as Team;

  test('no camera: no flight', () => expect(eventTarget(event(null), [fox('alpha', 'green')], home)).toBeNull());
  test('area: the fox centre at the event zoom', () => {
    expect(eventTarget(event({ kind: 'area', area: 'alpha', zoom: 12.4 }), [fox('alpha', 'green', [5.1, 52.2])], home)).toEqual({ center: [5.1, 52.2], zoom: 12.4 });
  });
  test('area whose fox has no centre: no flight', () => {
    expect(eventTarget(event({ kind: 'area', area: 'alpha', zoom: 12.4 }), [fox('alpha', 'green', null)], home)).toBeNull();
    expect(eventTarget(event({ kind: 'area', area: 'alpha', zoom: 12.4 }), [], home)).toBeNull();
  });
  test('home: the clubhouse at the tegenhunt zoom', () => {
    expect(eventTarget(event({ kind: 'home', direction: null }), [], home)).toEqual({ center: [5.5, 52.1], zoom: 12.2 });
  });
  test('home before the home team is known: no flight', () => expect(eventTarget(event({ kind: 'home', direction: 90 }), [], undefined)).toBeNull());
});
